import readline from 'readline'

/**
 * Asynchronously prompts the user with a yes or no question and returns a boolean value based on the user's input.
 *
 * @param {string} questionText The question to prompt the user with.
 * @returns {Promise<boolean>} A promise that resolves to `true` if the user's input is 'Y' (case-insensitive), otherwise `false`.
 */
export async function askYesOrNoQuestion(questionText: string): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  })

  const question = (): Promise<boolean> => {
    return new Promise((resolve) => {
      rl.question(questionText, (answer: string) => {
        rl.close()
        resolve(answer.trim().toUpperCase() === 'Y')
      })
    })
  }

  const isAnswerYes = await question()
  return isAnswerYes
}
