import { test, expect } from '@playwright/test'
test('known intermittent fixture must reject CI promotion', async ({}, info) => {
  expect(info.retry, 'Deliberately fail first attempt and pass the retry').toBe(1)
})
