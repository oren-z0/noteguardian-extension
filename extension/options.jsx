import {createRoot} from 'react-dom/client'
import React, {useState, useEffect} from 'react'

function Options() {
  const [isGettingCameraPermission, setIsGettingCameraPermission] = useState(false)
  const [cameraPermissionStatus, setCameraPermissionStatus] = useState(undefined)
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    if (cameraPermissionStatus !== undefined) {
      return
    }
    setErrorMessage('')
    const checkCameraPermission = async () => {
      try {
        const permissionStatus = await navigator.permissions.query({ name: 'camera' })
        if (permissionStatus) {
          setCameraPermissionStatus(permissionStatus)
        }
      } catch (error) {
        setErrorMessage(error.message || `${error}`)
      }
    }
    void checkCameraPermission()
  }, [cameraPermissionStatus])

  return (
    <div style={{ margin: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <img
          src="icons/48x48.png"
          alt="Note Guardian icon"
          width={48}
          height={48}
          style={{ borderRadius: 8 }}
        />
        <h1 style={{ paddingTop: 8, margin: 0 }}>Note Guardian</h1>
      </div>
      <div style={{ marginLeft: 8 }}>
        <h3>
          For more information, visit: <a href="https://niot.space/#NoteGuardian">niot.space</a>
        </h3>
        {!cameraPermissionStatus && <p>Checking camera permission...</p>}
        {cameraPermissionStatus && cameraPermissionStatus.state === 'granted' && <p>✅ Camera permission granted - open the popup to scan QR codes.</p>}
        {cameraPermissionStatus && cameraPermissionStatus.state === 'denied' && <p>❌ Camera permission denied - try reloading the page or check your browser settings.</p>}
        {
          cameraPermissionStatus && cameraPermissionStatus.state === 'prompt' && (
            <button
              className="btn"
              onClick={async () => {
                try {
                  setIsGettingCameraPermission(true)
                  await navigator.mediaDevices.getUserMedia({ video: true })
                } catch (error) {
                  setErrorMessage(error.message || `${error}`)
                } finally {
                  setCameraPermissionStatus(undefined)
                  setIsGettingCameraPermission(false)
                }
              }}
              disabled={isGettingCameraPermission}
            >
              Grant Camera Permission For QR Scanning
            </button>
          )
        }
        {
          errorMessage && <p style={{color: 'red'}}>{errorMessage}</p>
        }
      </div>
    </div>
  )
}

createRoot(document.getElementById('main')).render(<Options />)
