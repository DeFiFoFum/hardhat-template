import chalk from 'chalk'
import fs from 'fs'
import path from 'path'

export interface LoggerOptions {
  actor?: string
  color?: string
  verbose?: boolean
  silent?: boolean
  logDir?: string
  logFileName?: string
  fileExtension?: string
  networkName?: string
}

export class FileLogger {
  private logDir: string
  private logFile: string | null = null
  private currentDate: string
  private logFileName: string
  private fileExtension: string
  private networkName?: string

  constructor(logDir: string, logFileName: string, fileExtension: string = 'log', networkName?: string) {
    this.logDir = logDir
    this.logFileName = logFileName
    this.fileExtension = fileExtension
    this.networkName = networkName
    this.currentDate = new Date().toISOString().slice(0, 10).replace(/-/g, '')
    this.ensureLogDirectory()
  }

  private ensureLogDirectory(): void {
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true })
    }
  }

  private getLogFilePath(): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 16)
    const networkSuffix = this.networkName ? `-${this.networkName}` : ''
    return path.join(this.logDir, `${timestamp}-${this.logFileName}${networkSuffix}.${this.fileExtension}`)
  }

  private rotateLogFileIfNeeded(): void {
    const newDate = new Date().toISOString().slice(0, 10).replace(/-/g, '')
    if (newDate !== this.currentDate) {
      this.currentDate = newDate
      this.logFile = null
    }
  }

  private getLogFile(): string {
    this.rotateLogFileIfNeeded()
    if (!this.logFile) {
      this.logFile = this.getLogFilePath()
    }
    return this.logFile
  }

  writeLog(level: string, message: string, emoji: string = '', error?: Error): void {
    const timestamp = new Date().toISOString()
    const logFile = this.getLogFile()

    let logMessage = `[${timestamp}] ${level} ${emoji} ${message}\n`
    if (error) {
      logMessage += `Error: ${error.message}\n`
      if (error.stack) {
        logMessage += `Stack: ${error.stack}\n`
      }
    }

    fs.appendFileSync(logFile, logMessage)
  }

  writeHeader(message: string, emoji: string = ''): void {
    const timestamp = new Date().toISOString()
    const logFile = this.getLogFile()
    const separator = '='.repeat(50)
    const header = `\n[${timestamp}] ${separator}\n${emoji} ${message}\n${separator}\n`

    fs.appendFileSync(logFile, header)
  }
}

export class Logger {
  private actor: string
  private color: string
  private verbose: boolean
  private silent: boolean
  private fileLogger: FileLogger | null = null

  constructor({
    actor = '',
    color = 'white',
    verbose = false,
    silent = false,
    logDir,
    logFileName,
    fileExtension = 'log',
    networkName,
  }: LoggerOptions = {}) {
    this.actor = actor
    this.color = color
    this.verbose = verbose
    this.silent = silent

    if (logDir && logFileName) {
      this.fileLogger = new FileLogger(logDir, logFileName, fileExtension, networkName)
    }
  }

  setVerbose(verbose: boolean): void {
    this.verbose = verbose
  }

  setSilent(silent: boolean): void {
    this.silent = silent
  }

  info(msg: string): string {
    if (!this.verbose) return msg
    this.log(msg, '️  ', 'white')
    this.fileLogger?.writeLog('INFO', msg, '️  ')
    return msg
  }

  success(msg: string): string {
    this.log(msg, '✅', 'green')
    this.fileLogger?.writeLog('SUCCESS', msg, '✅')
    return msg
  }

  warn(msg: string, error?: Error): string {
    this.log(msg, '⚠️ ', 'yellow')
    this.fileLogger?.writeLog('WARN', msg, '⚠️ ', error)
    if (error) console.error(error)
    return msg
  }

  error(msg: string, error?: Error): string {
    this.log(msg, '🚨', 'red')
    this.fileLogger?.writeLog('ERROR', msg, '🚨', error)
    if (error) console.error(error)
    return msg
  }

  log(msg: string, emoji: string, color = 'white'): string {
    let formattedMessage = chalk.keyword(color)(`${emoji}  ${msg}`)
    if (this.verbose) {
      const formattedPrefix = chalk.keyword(this.color)(`[${this.actor}]`)
      formattedMessage = `${formattedPrefix} ${formattedMessage}`
    }
    if (this.silent) return formattedMessage
    console.error(formattedMessage)
    return formattedMessage
  }

  logHeader(msg: string, emoji: string, color = 'white'): void {
    this.log(`\n`, '')
    this.log(
      `\n========================================\n${emoji} ${msg}\n========================================`,
      '',
      color,
    )
    this.fileLogger?.writeHeader(msg, emoji)
  }
}

// Create and export a default console-only logger
export const defaultConsoleLogger = new Logger({
  actor: 'Default',
  color: 'white',
  verbose: false,
  silent: false,
})

// For backward compatibility, export the default logger as 'logger'
export const logger = defaultConsoleLogger
