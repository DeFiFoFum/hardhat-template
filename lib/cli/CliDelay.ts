import cliProgress from 'cli-progress'
import colors from 'ansi-colors'
// NOTE: ora sounds cool, but the imports were causing trouble
// import ora from 'ora';

export const delayWithLoadingBar = async (seconds: number): Promise<void> => {
  //   const spinner = ora(message).start();
  const bar = new cliProgress.SingleBar({
    format: colors.cyan('{bar}') + ' | {percentage}% | {value}/{total}s',
    barCompleteChar: '\u2588',
    barIncompleteChar: '\u2591',
    hideCursor: true,
    clearOnComplete: true,
  })

  bar.start(seconds, 0)

  for (let i = 0; i <= seconds; i++) {
    await new Promise((resolve) => setTimeout(resolve, 1000))
    bar.update(i)
  }

  bar.stop()
  //   spinner.succeed('Delay completed');
}
