window.nostr = {
  _requests: {},
  _pubkey: null,

  async getPublicKey() {
    if (this._pubkey) return this._pubkey
    this._pubkey = await this._call('getPublicKey', {})
    return this._pubkey
  },

  async signEvent(event) {
    return this._call('signEvent', {event})
  },

  async getRelays() {
    return {}
  },

  nip04: {
    async encrypt(peer, plaintext) {
      return window.nostr._call('nip04.encrypt', {peer, plaintext})
    },

    async decrypt(peer, ciphertext) {
      return window.nostr._call('nip04.decrypt', {peer, ciphertext})
    }
  },

  nip44: {
    async encrypt(peer, plaintext) {
      return window.nostr._call('nip44.encrypt', {peer, plaintext})
    },

    async decrypt(peer, ciphertext) {
      return window.nostr._call('nip44.decrypt', {peer, ciphertext})
    }
  },

  _idCounter: 0,

  _call(type, params) {
    const id = `${Math.random().toString(36).substring(2, 10)}-${this._idCounter}`
    this._idCounter += 1
    console.info(
      '%c[nos2x:%c' +
        id +
        '%c]%c calling %c' +
        type +
        '%c with %c' +
        JSON.stringify(params || {}),
      'background-color:#f1b912;font-weight:bold;color:white',
      'background-color:#f1b912;font-weight:bold;color:#a92727',
      'background-color:#f1b912;color:white;font-weight:bold',
      'color:auto',
      'font-weight:bold;color:#08589d;font-family:monospace',
      'color:auto',
      'font-weight:bold;color:#90b12d;font-family:monospace'
    )
    return new Promise((resolve, reject) => {
      this._requests[id] = {resolve, reject}
      window.postMessage(
        {
          id,
          ext: 'nos2x',
          type,
          params
        },
        '*'
      )
    })
  }
}

window.addEventListener('message', message => {
  if (
    !message.data ||
    message.data.response === null ||
    message.data.response === undefined ||
    message.data.ext !== 'nos2x' ||
    !window.nostr._requests[message.data.id]
  ) {
    return
  }

  console.info(
    '%c[nos2x:%c' +
      message.data.id +
      '%c]%c result: %c' +
      JSON.stringify(
        message?.data?.response || message?.data?.response?.error?.message || {}
      ),
    'background-color:#f1b912;font-weight:bold;color:white',
    'background-color:#f1b912;font-weight:bold;color:#a92727',
    'background-color:#f1b912;color:white;font-weight:bold',
    'color:auto',
    'font-weight:bold;color:#08589d'
  )

  if (message.data.response.success) {
    window.nostr._requests[message.data.id].resolve(message.data.response.result)
  } else {
    const internalError = message.data.response.error ?? new Error('nos2x: unknown error')
    const error = new Error('nos2x: ' + internalError)
    error.stack = message.data.response.error.stack
    window.nostr._requests[message.data.id].reject(error)
  }

  delete window.nostr._requests[message.data.id]
})
