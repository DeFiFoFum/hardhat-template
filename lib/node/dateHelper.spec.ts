import { getDateDayString, getDateMinuteString, getDaysAgo, getUnixTimestampAndNextDay } from './dateHelper'
import { expect } from 'chai'

describe('dateHelper', () => {
  describe('getDateDayString', () => {
    it('should return the current date in YYYYMMDD format', () => {
      const date = new Date('2023-03-30T12:10:00Z')
      expect(getDateDayString(date)).to.equal('20230330')
    })
  })

  describe('getDateMinuteString', () => {
    it('should return the current date and time in YYYYMMDD_HHMM format', () => {
      const date = new Date('2023-03-30T12:10:00Z')
      expect(getDateMinuteString(date)).to.equal('20230330_1210')
    })
  })

  describe('getDaysAgo', () => {
    it('should return the number of days ago from the current date', () => {
      const dateString = new Date()
      dateString.setDate(dateString.getDate() - 5)
      expect(getDaysAgo(dateString.toISOString())).to.equal(5)
    })
  })

  describe('getUnixTimestampAndNextDay', () => {
    it('should return the Unix timestamp and the next day timestamp for a given date string', () => {
      const dateString = '2023-03-30T12:10:00Z'
      const [timestamp, nextDayTimestamp] = getUnixTimestampAndNextDay(dateString)
      expect(timestamp).to.equal(Math.floor(new Date(dateString).getTime() / 1000))
      expect(nextDayTimestamp).to.equal(timestamp + 24 * 3600)
    })

    it('should return the Unix timestamp and the next day timestamp for a given timestamp', () => {
      const timestamp = 1679874600 // Example timestamp
      const [resultTimestamp, nextDayTimestamp] = getUnixTimestampAndNextDay(timestamp)
      expect(resultTimestamp).to.equal(timestamp)
      expect(nextDayTimestamp).to.equal(timestamp + 24 * 3600)
    })
  })
})
