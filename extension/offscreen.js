import browser from 'webextension-polyfill'

let peerConnection = null
let dataChannel = null
let offerInFlight = false

window.getPeerConnection = () => peerConnection

function resetPeer() {
  if (!peerConnection) {
    return
  }
  try {
    dataChannel?.close()
  } catch (err) {
    console.error('Failed to close dataChannel', err)
  }
  try {
    peerConnection?.close()
  } catch (err) {
    console.error('Failed to close peerConnection', err)
  }
  dataChannel = null
  peerConnection = null
}

async function makeOffer(refresh) {
  if (offerInFlight) {
    return
  }
  offerInFlight = true
  try {
    if (!refresh && peerConnection) {
      return peerConnection.localDescription
    }
    resetPeer()

    const newPeerConnection = new RTCPeerConnection({ iceServers: [] })
    peerConnection = newPeerConnection

    const newDataChannel = peerConnection.createDataChannel('lan')
    dataChannel = newDataChannel

    newDataChannel.onopen = () => {
      console.info('DataChannel open', newDataChannel.id)
    }
    newDataChannel.onclose = () => {
      console.info('DataChannel closed', newDataChannel.id)
    }

    newPeerConnection.onconnectionstatechange = async () => {
      console.info('Connection state changed', newPeerConnection.connectionState, offerInFlight, peerConnection === newPeerConnection)
      if (offerInFlight || peerConnection !== newPeerConnection) {
        return
      }
      // Optional: auto-cleanup on terminal states
      if (['failed', 'disconnected', 'closed'].includes(newPeerConnection.connectionState)) {
        resetPeer()
      } else if (newPeerConnection.connectionState === 'connected') {
        browser.runtime.sendMessage({ type: 'CONNECTION_ESTABLISHED' })
      }
    }

    // Wait until ICE gathering completes so you share a single, final SDP
    const iceGatheringDone = new Promise((resolve) => {
      if (newPeerConnection.iceGatheringState === 'complete') {
        return resolve()
      }
      newPeerConnection.onicegatheringstatechange = () => {
        if (newPeerConnection.iceGatheringState === 'complete') {
          resolve()
        }
      }
    })

    await newPeerConnection.setLocalDescription(await newPeerConnection.createOffer())
    await iceGatheringDone

    // Persist the complete SDP for the UI to read (popup/options)
    return newPeerConnection.localDescription
  } catch (err) {
    console.error('Failed to make offer', err)
    resetPeer()
  } finally {
    offerInFlight = false
  }
}

async function setAnswer(answerSdp) {
  if (!peerConnection) {
    return
  }
  try {
    try {
      await peerConnection.setRemoteDescription(new RTCSessionDescription({ type: 'answer', sdp: answerSdp }))
    } catch (e) {
      console.info('Failed to set answer, trying to add newline', e.message)
      await peerConnection.setRemoteDescription(new RTCSessionDescription({ type: 'answer', sdp: answerSdp + '\n' }))
    }
    return true
  } catch (err) {
    console.error('Failed to set answer', err.message)
  }
  return false
}

browser.runtime.onMessage.addListener((msg, sender) => {
  if (
    msg.type === 'MAKE_OFFER' &&
    sender?.url &&
    sender.url.startsWith(browser.runtime.getURL('popup.html'))
  ) {
    console.info('Make offer', msg, sender)
    return makeOffer(msg.refresh)
  }
  if (
    msg.type === 'SET_ANSWER' &&
    sender?.url &&
    sender.url.startsWith(browser.runtime.getURL('popup.html'))
  ) {
    console.info('Set answer', msg, sender)
    return setAnswer(msg.answerSdp)
  }
})

const nostrTypes = new Set([
  'getPublicKey',
  'signEvent',
  'getRelays',
  'nip04.encrypt',
  'nip04.decrypt',
  'nip44.encrypt',
  'nip44.decrypt'
])

browser.runtime.onMessage.addListener(({type, params}, sender) => {
  if (!nostrTypes.has(type)) {
    return
  }
  return performOperation(type, params)
})

let requestIdCounter = 0
const requestIdPrefix = Math.random().toString(36).substring(2, 10)

async function performOperation(type, params) {
  console.info('performOperation', type, params)
  if (!dataChannel) {
    console.info('performOperation no data channel')
    return {error: {message: 'No data channel'}}
  }

  try {
    const id = `${requestIdPrefix}-${requestIdCounter}`
    requestIdCounter += 1
    const message = {type, params, id }
    console.info('offscreen.js sending message', message)
    // Send the message
    dataChannel.send(JSON.stringify(message))

    // Wait for response using Promise + addEventListener
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        dataChannel.removeEventListener('message', handleMessage)
        dataChannel.removeEventListener('error', handleError)
        reject(new Error('Operation timeout'))
      }, 60000) // 1 minute timeout

      function handleMessage(event) {
        console.info('offscreen.js handleMessage', event)
        try {
          const response = JSON.parse(event.data)
          if (response.id === id) {
            clearTimeout(timeout)
            dataChannel.removeEventListener('message', handleMessage)
            dataChannel.removeEventListener('error', handleError)
            resolve(response)
          }
        } catch (e) {
          console.error('offscreen.js handleMessage error', e)
        }
      }

      function handleError(error) {
        console.error('offscreen.js handleError', error)
        clearTimeout(timeout)
        dataChannel.removeEventListener('message', handleMessage)
        dataChannel.removeEventListener('error', handleError)
        reject(error)
      }

      dataChannel.addEventListener('message', handleMessage)
      dataChannel.addEventListener('error', handleError)
    })
  } catch (error) {
    return {error: {message: error.message, stack: error.stack}}
  }
}
