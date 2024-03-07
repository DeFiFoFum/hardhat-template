/**
 * This function takes an error and an optional length parameter and returns the error message. If a length is provided, it returns a substring of the error message.
 * @param error - The error object or message
 * @param errorMessageLength - Optional length for the error message substring
 * @returns The error message or its substring
 *
 * Usage example:
 * const errorMessage = getErrorMessage(error, 100);
 * console.log(errorMessage); // Output: 'Error message with a maximum length of 100 characters'
 */
export const getErrorMessage = (error: unknown, errorMessageLength?: number): string => {
  let message: string
  if (error instanceof Error) {
    message = error.message
  } else if (error && typeof error === 'object' && 'message' in error) {
    message = String(error.message)
  } else if (typeof error === 'string') {
    message = error
  } else {
    message = 'Something went wrong.'
  }

  return errorMessageLength ? message.substring(0, errorMessageLength) : message
}
