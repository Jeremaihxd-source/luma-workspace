export const VAPID_PUBLIC_KEY = 'BC4usi7_Wwe0RMbcGU3pQIJoFobho-e86eR53hT8iWlQzI-jkus9fcpcr9290_CQ-EtdD3DMKn-gfbbU-LqVlJ4'

export function urlBase64ToUint8Array(value) {
  const padding = '='.repeat((4 - value.length % 4) % 4)
  const base64 = (value + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  return Uint8Array.from([...raw].map((character) => character.charCodeAt(0)))
}
