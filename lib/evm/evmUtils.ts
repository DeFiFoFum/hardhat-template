export const addressToHexData = (address: string) => {
  return address.startsWith('0x') ? address.toLowerCase().slice(2) : address.toLowerCase()
}
