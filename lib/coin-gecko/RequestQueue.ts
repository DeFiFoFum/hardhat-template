export class RequestQueue {
  private queue: (() => Promise<void>)[] = []
  private requestCount = 0
  private readonly maxRequestsPerMinute: number

  constructor(maxRequestsPerMinute: number) {
    this.maxRequestsPerMinute = maxRequestsPerMinute

    // Reset the request count every minute
    setInterval(() => {
      this.requestCount = 0
      this.processQueue() // Process any queued requests
    }, 60000)
  }

  private processQueue() {
    if (this.queue.length === 0 || this.requestCount >= this.maxRequestsPerMinute) {
      return
    }

    const nextRequest = this.queue.shift()
    if (nextRequest) {
      this.requestCount++
      nextRequest().finally(() => {
        setTimeout(() => {
          this.requestCount--
          this.processQueue()
        }, 60000 / this.maxRequestsPerMinute) // Delay to distribute requests evenly within the minute
      })
    }
  }

  public enqueue(requestFunction: () => Promise<void>) {
    this.queue.push(requestFunction)
    this.processQueue()
  }
}
