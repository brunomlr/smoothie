/**
 * Query Parameter Validation Utilities
 */

import { ValidationError } from './errors'

export interface ParsedParams {
  [key: string]: string | number | string[] | undefined
}

/**
 * Parse and validate a required string parameter
 */
export function requireString(
  params: URLSearchParams,
  name: string
): string {
  const value = params.get(name)
  if (!value) {
    throw new ValidationError(`Missing required parameter: ${name}`, name)
  }
  return value
}

/**
 * Parse an optional string parameter
 */
export function optionalString(
  params: URLSearchParams,
  name: string
): string | undefined {
  return params.get(name) || undefined
}

/**
 * Parse and validate a required integer parameter
 */
export function requireInt(
  params: URLSearchParams,
  name: string,
  options?: { min?: number; max?: number }
): number {
  const value = params.get(name)
  if (!value) {
    throw new ValidationError(`Missing required parameter: ${name}`, name)
  }
  return validateInt(value, name, options)
}

/**
 * Parse an optional integer parameter with default
 */
export function optionalInt(
  params: URLSearchParams,
  name: string,
  defaultValue: number,
  options?: { min?: number; max?: number }
): number {
  const value = params.get(name)
  if (!value) return defaultValue
  return validateInt(value, name, options)
}

function validateInt(
  value: string,
  name: string,
  options?: { min?: number; max?: number }
): number {
  const num = parseInt(value, 10)
  if (isNaN(num)) {
    throw new ValidationError(`${name} must be a valid integer`, name)
  }
  if (options?.min !== undefined && num < options.min) {
    throw new ValidationError(`${name} must be at least ${options.min}`, name)
  }
  if (options?.max !== undefined && num > options.max) {
    throw new ValidationError(`${name} must be at most ${options.max}`, name)
  }
  return num
}

/**
 * Parse a comma-separated list parameter
 */
export function parseList(
  params: URLSearchParams,
  name: string
): string[] | undefined {
  const value = params.get(name)
  if (!value) return undefined
  return value.split(',').filter(Boolean)
}

/**
 * Parse a required comma-separated list parameter
 */
export function requireList(
  params: URLSearchParams,
  name: string
): string[] {
  const value = params.get(name)
  if (!value) {
    throw new ValidationError(`Missing required parameter: ${name}`, name)
  }
  const list = value.split(',').filter(Boolean)
  if (list.length === 0) {
    throw new ValidationError(`${name} cannot be empty`, name)
  }
  return list
}

/**
 * Parse a JSON parameter
 */
export function parseJson<T>(
  params: URLSearchParams,
  name: string,
  defaultValue: T
): T {
  const value = params.get(name)
  if (!value) return defaultValue
  try {
    return JSON.parse(value) as T
  } catch {
    console.warn(`[Query Parser] Failed to parse ${name} as JSON`)
    return defaultValue
  }
}

/**
 * Get user timezone from params, defaulting to UTC
 */
export function getTimezone(params: URLSearchParams): string {
  return params.get('timezone') || 'UTC'
}
