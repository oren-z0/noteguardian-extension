# NoteGuardian

### notes and other stuff signed by an extension - remotely!

## Nostr Remote-Signer Extension

Use this to sign [Nostr](https://github.com/nostr-protocol/nostr) events on web-apps without having to save the key on the local computer.

It implements [NIP-07](https://github.com/nostr-protocol/nips/blob/master/07.md), i.e. provides a `window.nostr` object which has the following methods:

```
async window.nostr.getPublicKey(): string // returns your public key as hex
async window.nostr.signEvent(event): Event // returns the full event object signed
async window.nostr.nip04.encrypt(pubkey, plaintext): string // returns ciphertext+iv as specified in nip04
async window.nostr.nip04.decrypt(pubkey, ciphertext): string // takes ciphertext+iv as specified in nip04
async window.nostr.nip44.encrypt(pubkey, plaintext): string // takes pubkey, plaintext, returns ciphertext as specified in nip-44
async window.nostr.nip44.decrypt(pubkey, ciphertext): string // takes pubkey, ciphertext, returns plaintext as specified in nip-44
```

Using [WebRTC](https://webrtc.org/) to establish a direct connection between the browser and a web-app on a different local-network device (i.e. your phone).

See: https://niot.space/#NoteGuardian

This extension is Chromium-only.

Forked from [nos2x](https://github.com/fiatjaf/nos2x).

## Develop

To run the plugin from this code:

```
git clone https://github.com/fiatjaf/noteguardian
cd noteguardian
yarn
./build.js prod
```

then

1. go to `chrome://extensions`;
2. ensure "developer mode" is enabled on the top right;
3. click on "Load unpackaged";
4. select the `extension/` folder of this repository.
