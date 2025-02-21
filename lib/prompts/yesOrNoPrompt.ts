export function createYesOrNoPrompt(promptText: string, abortText: string): Promise<boolean> {
  const readline = require('readline').createInterface({
    input: process.stdin,
    output: process.stdout,
  })

  return new Promise((resolve, reject) => {
    readline.question(promptText, (answer: string) => {
      readline.close()
      if (answer.trim().toUpperCase() === 'Y') {
        resolve(true)
      } else {
        reject(new Error(abortText))
      }
    })
  })
}
