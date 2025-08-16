import browser from 'webextension-polyfill'
import {createRoot} from 'react-dom/client'
import React, {useState, useEffect, useRef} from 'react'
import QRCode from 'react-qr-code'
import jsQR from 'jsqr'

function Popup() {
  const [offerSdp, setOfferSdp] = useState(undefined)
  const [connectionState, setConnectionState] = useState('init')
  const [copied, setCopied] = useState(false)
  const [answerSdp, setAnswerSdp] = useState('')
  const [answerError, setAnswerError] = useState('')
  const [isScanning, setIsScanning] = useState(false)

  // QR Scanner refs and state
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const scanIntervalRef = useRef(null)
  const fetchOffer = async (refresh) => {
    // Will unset offerSdp only if operation takes too long
    const resetSdpTimeout = setTimeout(() => setOfferSdp(undefined), 200)
    try {
      console.info('fetchOffer', refresh)
      setConnectionState('init')
      setAnswerSdp('')
      setAnswerError('')
      await browser.runtime.sendMessage({ type: 'ENSURE_OFFSCREEN' })
      const newOffer = await browser.runtime.sendMessage({ type: 'MAKE_OFFER', refresh })
      console.info('newOffer', newOffer)
      if (newOffer && newOffer.type === 'offer') {
        clearTimeout(resetSdpTimeout)
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

  // QR Scanner functions using jsQR
  const scanForQR = () => {
    if (!videoRef.current || !canvasRef.current) return

    const video = videoRef.current
    const canvas = canvasRef.current
    const context = canvas.getContext('2d')

    if (video.readyState === video.HAVE_ENOUGH_DATA) {
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      context.drawImage(video, 0, 0, canvas.width, canvas.height)

      const imageData = context.getImageData(0, 0, canvas.width, canvas.height)
      const code = jsQR(imageData.data, imageData.width, imageData.height, {
        inversionAttempts: 'dontInvert',
      })

      if (code) {
        console.log('QR Code detected:', code.data)
        setAnswerSdp(code.data)
        stopQrScanning()
      }
    }
  }

  const startQrScanning = async () => {
    try {
      console.info('Starting QR scanning')
      setIsScanning(true)
      setAnswerError('')

      const permissionStatus = await navigator.permissions.query({ name: 'camera' })
      if (!permissionStatus || permissionStatus.state !== 'granted') {
        window.open(browser.runtime.getURL('options.html'), '_blank')
        setAnswerError('Must grant camera permissions for QR scanning')
        setIsScanning(false)
        return
      }

      // Get camera stream
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment', // Prefer back camera for QR scanning
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      })

      if (videoRef.current) {
        videoRef.current.srcObject = stream

        // Wait for video to load
        videoRef.current.addEventListener('loadedmetadata', () => {
          videoRef.current.play()

          // Start scanning loop
          scanIntervalRef.current = setInterval(scanForQR, 100) // Scan every 100ms
        })
      }

      console.log('QR scanner started successfully')
    } catch (error) {
      console.error('Failed to start QR scanner:', error)
      setAnswerError('Failed to start QR scanner: ' + error.message)
      setIsScanning(false)
    }
  }

  const stopQrScanning = () => {
    try {
      console.info('Stopping QR scanning')

      // Stop scanning interval
      if (scanIntervalRef.current) {
        clearInterval(scanIntervalRef.current)
        scanIntervalRef.current = null
      }

      // Clean up video stream
      if (videoRef.current && videoRef.current.srcObject) {
        const tracks = videoRef.current.srcObject.getTracks()
        tracks.forEach(track => track.stop())
        videoRef.current.srcObject = null
      }

      setIsScanning(false)
    } catch (error) {
      console.error('Failed to stop QR scanner:', error)
      setAnswerError('Failed to stop QR scanner: ' + error.message)
      setIsScanning(false)
    }
  }

  // Cleanup QR scanner on unmount
  useEffect(() => {
    return () => {
      if (isScanning) {
        stopQrScanning()
      }
    }
  }, [])

  const offerUrl = offerSdp && `https://guardian.niot.space/#offer=${encodeURIComponent(offerSdp)}`

  return (
    <div style={{marginBottom: '5px', minWidth: '210px' }}>
      <h2 style={{ whiteSpace: 'nowrap', textAlign: 'center', width: '100%', marginBottom: '10px' }}>Note Guardian</h2>
      {
        connectionState === 'connected' ? (
          <>
            <p>✅ Connected</p>
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: '10px' }}>
              <button
                className="btn"
                style={{
                  width: '100px'
                }}
                onClick={() => fetchOffer(true)}
              >
                Reset
              </button>
            </div>
          </>
        ) : (
          offerUrl ? (
            <>
              <div
                style={{
                  height: 'auto',
                  minWidth: 210,
                  minHeight: 210,
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
              {
                !isScanning && (
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
                )
              }
              {isScanning && (
                <div style={{marginTop: '10px', display: 'flex', flexDirection: 'column', alignItems: 'center'}}>
                  {/* Video element for QR scanning */}
                  <video
                    ref={videoRef}
                    style={{
                      width: '100%',
                      maxWidth: '300px',
                      height: 'auto',
                      border: '2px solid #ccc',
                      borderRadius: '8px',
                      marginBottom: '10px'
                    }}
                    autoPlay
                    playsInline
                    muted
                  />

                  {/* Hidden canvas for image processing */}
                  <canvas
                    ref={canvasRef}
                    style={{ display: 'none' }}
                  />

                  <p>Point camera at QR code.</p>
                  <button
                    style={{marginTop: '10px'}}
                    className="btn"
                    onClick={stopQrScanning}
                    disabled={connectionState === 'connecting'}
                  >
                    Stop Scan
                  </button>
                </div>
              )}

              {/* Scan QR Code Button */}
              {!isScanning && (
                <div style={{marginTop: '10px', display: 'flex', justifyContent: 'center'}}>
                  <button
                    className="btn"
                    onClick={startQrScanning}
                    disabled={connectionState === 'connecting'}
                  >
                    Scan QR Code
                  </button>
                </div>
              )}

              {answerError && <p style={{color: 'red'}}>{answerError}</p>}
            </>
          ) : (
            <p>Getting WebRTC offer...</p>
          )
        )
      }
    </div>
  )
}

createRoot(document.getElementById('main')).render(<Popup />)

