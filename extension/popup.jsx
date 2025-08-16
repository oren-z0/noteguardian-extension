import browser from 'webextension-polyfill'
import {createRoot} from 'react-dom/client'
import React, {useState, useEffect} from 'react'
import QRCode from 'react-qr-code'

function Popup() {
  const [offerSdp, setOfferSdp] = useState(undefined)
  const [connectionState, setConnectionState] = useState('init')
  const [copied, setCopied] = useState(false)
  const [answerSdp, setAnswerSdp] = useState('')
  const [answerError, setAnswerError] = useState('')
  const fetchOffer = async (refresh) => {
    try {
      setOfferSdp(undefined)
      setConnectionState('init')
      setAnswerSdp('')
      setAnswerError('')
      await browser.runtime.sendMessage({ type: 'ENSURE_OFFSCREEN' })
      const newOffer = await browser.runtime.sendMessage({ type: 'MAKE_OFFER', refresh })
      console.info('newOffer', newOffer)
      if (newOffer && newOffer.type === 'offer') {
        setOfferSdp(newOffer.sdp)
      }
    } catch (err) {
      console.error('Failed to fetch offer', err)
    }
  }
  useEffect(() => {
    fetchOffer(false)
    const listener = (msg, sender) => {
      if (msg.type === 'CONNECTION_ESTABLISHED') {
        setConnectionState('connected')
      }
    }
    browser.runtime.onMessage.addListener(listener)
    return () => {
      browser.runtime.onMessage.removeListener(listener)
    }
  }, [])
  useEffect(() => {
    if (copied) {
      const timeout = setTimeout(() => {
        setCopied(false)
      }, 2000)
      return () => clearTimeout(timeout)
    }
  }, [copied])
  useEffect(() => {
    const setAnswer = async () => {
      if (!answerSdp) {
        return
      }
      const success = await browser.runtime.sendMessage({ type: 'SET_ANSWER', answerSdp })
      if (!success) {
        setAnswerError('Failed to set answer')
        return
      }
      setConnectionState('connecting')
    }
    setAnswer()
  }, [answerSdp])
  useEffect(() => {
    if (connectionState === 'connecting') {
      const timeout = setTimeout(() => {
        setConnectionState('init')
        setAnswerError('Timed out waiting for connection')
      }, 3000)
      return () => clearTimeout(timeout)
    }
  }, [connectionState])

  const offerUrl = offerSdp && `https://guardian.niot.space/#offer=${encodeURIComponent(offerSdp)}`

  return (
    <div style={{marginBottom: '5px'}}>
      <h2 style={{ whiteSpace: 'nowrap', textAlign: 'center', width: '100%', marginBottom: '10px' }}>Note Guardian</h2>
      {
        connectionState === 'connected' ? (
          <>
            <p>Connected</p>
            <button
              className="btn"
              style={{
                width: '100px'
              }}
              onClick={() => fetchOffer(true)}
            >
              Reset
            </button>
          </>
        ) : (
          offerUrl ? (
            <>
              <div
                style={{
                  height: 'auto',
                  // margin: '0 auto',
                  maxWidth: 256,
                  width: '100%'
                }}
              >
                <QRCode
                  size={256}
                  style={{height: 'auto', maxWidth: '100%', width: '100%'}}
                  value={offerUrl}
                  viewBox="0 0 256 256"
                />
              </div>
              <div style={{display: 'flex', justifyContent: 'center', marginTop: '10px', gap: '10px' }}>
                <button
                  className="btn"
                  style={{
                    width: '100px'
                  }}
                  onClick={() => fetchOffer(true)}
                >
                  Reset
                </button>
                <button
                  className="btn"
                  style={{
                    width: '100px'
                  }}
                  onClick={async () => {
                    await navigator.clipboard.writeText(offerUrl)
                    setCopied(true)
                  }}
                  disabled={copied}
                >
                  {copied ? 'Copied' : 'Copy'}
                </button>
              </div>
              <div style={{marginTop: '10px', display: 'flex', justifyContent: 'center', gap: '10px' }}>
                <textarea
                  value={answerSdp}
                  onChange={(e) => setAnswerSdp(e.target.value)}
                  placeholder="Paste Answer SDP here"
                  style={{
                    width: '100%',
                    height: '100px',
                    resize: 'none',
                    padding: '10px',
                    borderRadius: '5px',
                    border: '1px solid #ccc',
                    fontSize: '14px',
                  }}
                  disabled={connectionState === 'connecting'}
                />
              </div>
              {answerError && <p style={{color: 'red'}}>{answerError}</p>}
            </>
          ) : (
            <p>Fetching WebRTC offer...</p>
          )
        )
      }
    </div>
  )
}

createRoot(document.getElementById('main')).render(<Popup />)
