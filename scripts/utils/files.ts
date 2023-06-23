import fs from 'fs'
import path from 'path'

/**
 * Searches for local files in the specified directory and returns an array of file names.
 * @param {string} dirPath - The directory path to search for files.
 * @param {string[]} fileExtensions - An array of file extensions to filter the results.
 * @returns {Promise<string[]>} A promise that resolves to an array of file names.
 */
export async function searchLocalFiles(dirPath: string, fileExtensions: string[] = ['.ts', '.js']): Promise<string[]> {
  return new Promise((resolve, reject) => {
    fs.readdir(dirPath, (error, files) => {
      if (error) {
        reject(error)
      } else {
        const filteredFiles = files.filter((file) => fileExtensions.includes(path.extname(file)))
        resolve(filteredFiles)
      }
    })
  })
}
