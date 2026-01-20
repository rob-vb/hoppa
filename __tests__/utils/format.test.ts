import {
  formatDate,
  formatTimeOfDay,
  formatDuration,
  formatTimer,
  formatRelativeDate,
  getDateGroupTitle,
} from '@/utils/format';

describe('format utilities', () => {
  describe('formatDate', () => {
    it('should format a timestamp as a date string', () => {
      // January 15, 2024
      const timestamp = new Date(2024, 0, 15).getTime();
      const result = formatDate(timestamp);
      // Result depends on locale, but should contain the key parts
      expect(result).toContain('15');
      expect(result).toContain('2024');
    });

    it('should handle different months', () => {
      const december = new Date(2024, 11, 25).getTime();
      const result = formatDate(december);
      expect(result).toContain('25');
      expect(result).toContain('2024');
    });

    it('should handle epoch timestamp', () => {
      const result = formatDate(0);
      expect(result).toContain('1970');
    });
  });

  describe('formatTimeOfDay', () => {
    it('should format a timestamp as a time string', () => {
      // 3:45 PM
      const timestamp = new Date(2024, 0, 15, 15, 45).getTime();
      const result = formatTimeOfDay(timestamp);
      // Should contain 3 or 15 depending on locale (12h vs 24h)
      expect(result).toMatch(/\d{1,2}:\d{2}/);
    });

    it('should format midnight', () => {
      const midnight = new Date(2024, 0, 15, 0, 0).getTime();
      const result = formatTimeOfDay(midnight);
      // Should be 12:00 AM or 0:00 depending on locale
      expect(result).toMatch(/\d{1,2}:\d{2}/);
    });

    it('should format noon', () => {
      const noon = new Date(2024, 0, 15, 12, 0).getTime();
      const result = formatTimeOfDay(noon);
      expect(result).toMatch(/\d{1,2}:\d{2}/);
    });
  });

  describe('formatDuration', () => {
    it('should format duration less than an hour', () => {
      const thirtyMin = 30 * 60 * 1000;
      expect(formatDuration(thirtyMin)).toBe('30 min');
    });

    it('should format duration exactly one hour', () => {
      const oneHour = 60 * 60 * 1000;
      expect(formatDuration(oneHour)).toBe('1h 0m');
    });

    it('should format duration with hours and minutes', () => {
      const oneHourThirty = 90 * 60 * 1000;
      expect(formatDuration(oneHourThirty)).toBe('1h 30m');
    });

    it('should format zero duration', () => {
      expect(formatDuration(0)).toBe('0 min');
    });

    it('should floor partial minutes', () => {
      const fortyFiveAndAHalf = 45.5 * 60 * 1000;
      expect(formatDuration(fortyFiveAndAHalf)).toBe('45 min');
    });

    it('should handle multi-hour durations', () => {
      const threeHoursFifteen = (3 * 60 + 15) * 60 * 1000;
      expect(formatDuration(threeHoursFifteen)).toBe('3h 15m');
    });
  });

  describe('formatTimer', () => {
    it('should format seconds under a minute', () => {
      expect(formatTimer(45)).toBe('0:45');
      expect(formatTimer(5)).toBe('0:05');
      expect(formatTimer(0)).toBe('0:00');
    });

    it('should format minutes and seconds', () => {
      expect(formatTimer(90)).toBe('1:30');
      expect(formatTimer(125)).toBe('2:05');
      expect(formatTimer(600)).toBe('10:00');
    });

    it('should format hours minutes and seconds', () => {
      expect(formatTimer(3600)).toBe('1:00:00');
      expect(formatTimer(3665)).toBe('1:01:05');
      expect(formatTimer(7200)).toBe('2:00:00');
    });

    it('should pad seconds correctly', () => {
      expect(formatTimer(61)).toBe('1:01');
      expect(formatTimer(3601)).toBe('1:00:01');
    });

    it('should pad minutes correctly when hours present', () => {
      expect(formatTimer(3660)).toBe('1:01:00');
      expect(formatTimer(3900)).toBe('1:05:00');
    });
  });

  describe('formatRelativeDate', () => {
    // Use fixed "now" for consistent testing
    const now = new Date();
    const today = now.getTime();
    const oneDay = 24 * 60 * 60 * 1000;

    it('should return "Today" for today\'s date', () => {
      expect(formatRelativeDate(today)).toBe('Today');
    });

    it('should return "Yesterday" for yesterday', () => {
      const yesterday = today - oneDay;
      expect(formatRelativeDate(yesterday)).toBe('Yesterday');
    });

    it('should return "X days ago" for 2-6 days ago', () => {
      expect(formatRelativeDate(today - 2 * oneDay)).toBe('2 days ago');
      expect(formatRelativeDate(today - 3 * oneDay)).toBe('3 days ago');
      expect(formatRelativeDate(today - 6 * oneDay)).toBe('6 days ago');
    });

    it('should return "Last week" for 7-13 days ago', () => {
      expect(formatRelativeDate(today - 7 * oneDay)).toBe('Last week');
      expect(formatRelativeDate(today - 10 * oneDay)).toBe('Last week');
      expect(formatRelativeDate(today - 13 * oneDay)).toBe('Last week');
    });

    it('should return "X weeks ago" for 14-29 days ago', () => {
      expect(formatRelativeDate(today - 14 * oneDay)).toBe('2 weeks ago');
      expect(formatRelativeDate(today - 21 * oneDay)).toBe('3 weeks ago');
      expect(formatRelativeDate(today - 28 * oneDay)).toBe('4 weeks ago');
    });

    it('should return formatted date for 30+ days ago', () => {
      const thirtyDaysAgo = today - 30 * oneDay;
      const result = formatRelativeDate(thirtyDaysAgo);
      // Should return formatted date like "Dec 21, 2023"
      expect(result).not.toBe('Today');
      expect(result).not.toBe('Yesterday');
      expect(result).not.toContain('ago');
    });

    it('should handle timestamps at different times of day', () => {
      // Same calendar day but earlier in the day
      const earlierToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0).getTime();
      expect(formatRelativeDate(earlierToday)).toBe('Today');
    });
  });

  describe('getDateGroupTitle', () => {
    const now = new Date();
    const today = now.getTime();
    const oneDay = 24 * 60 * 60 * 1000;

    it('should return "Today" for today\'s date', () => {
      expect(getDateGroupTitle(today)).toBe('Today');
    });

    it('should return "Yesterday" for yesterday', () => {
      expect(getDateGroupTitle(today - oneDay)).toBe('Yesterday');
    });

    it('should return "This Week" for 2-6 days ago', () => {
      expect(getDateGroupTitle(today - 2 * oneDay)).toBe('This Week');
      expect(getDateGroupTitle(today - 6 * oneDay)).toBe('This Week');
    });

    it('should return "Last Week" for 7-13 days ago', () => {
      expect(getDateGroupTitle(today - 7 * oneDay)).toBe('Last Week');
      expect(getDateGroupTitle(today - 13 * oneDay)).toBe('Last Week');
    });

    it('should return "This Month" for 14-29 days ago', () => {
      expect(getDateGroupTitle(today - 14 * oneDay)).toBe('This Month');
      expect(getDateGroupTitle(today - 29 * oneDay)).toBe('This Month');
    });

    it('should return month and year for 30+ days ago', () => {
      const sixtyDaysAgo = today - 60 * oneDay;
      const result = getDateGroupTitle(sixtyDaysAgo);
      // Should return something like "November 2023"
      expect(result).not.toBe('Today');
      expect(result).not.toBe('Yesterday');
      expect(result).not.toBe('This Week');
      expect(result).not.toBe('Last Week');
      expect(result).not.toBe('This Month');
    });
  });
});
