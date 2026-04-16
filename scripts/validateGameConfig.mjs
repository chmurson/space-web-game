import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'

import { parse } from 'yaml'

const rootDir = process.cwd()
const configDir = path.join(rootDir, 'config')
const schemaPath = path.join(configDir, 'game-config.schema.json')

const formatPath = (segments) =>
  segments.length === 0 ? '<root>' : segments.join('.')

const getTypeName = (value) => {
  if (Array.isArray(value)) {
    return 'array'
  }
  if (value === null) {
    return 'null'
  }

  return typeof value
}

const validateAgainstSchema = (value, schema, pathSegments = []) => {
  const errors = []

  if (schema.type === 'object') {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      return [
        `${formatPath(pathSegments)} should be an object, got ${getTypeName(value)}`,
      ]
    }

    const properties = schema.properties ?? {}

    if (schema.additionalProperties === false) {
      for (const key of Object.keys(value)) {
        if (!(key in properties)) {
          errors.push(`${formatPath([...pathSegments, key])} is not allowed`)
        }
      }
    }

    for (const [key, propertySchema] of Object.entries(properties)) {
      if (value[key] !== undefined) {
        errors.push(
          ...validateAgainstSchema(value[key], propertySchema, [
            ...pathSegments,
            key,
          ]),
        )
      }
    }

    return errors
  }

  if (schema.type === 'array') {
    if (!Array.isArray(value)) {
      return [
        `${formatPath(pathSegments)} should be an array, got ${getTypeName(value)}`,
      ]
    }

    const itemSchema = schema.items

    if (!itemSchema) {
      return errors
    }

    value.forEach((item, index) => {
      errors.push(
        ...validateAgainstSchema(item, itemSchema, [
          ...pathSegments,
          String(index),
        ]),
      )
    })

    return errors
  }

  if (schema.type === 'number') {
    if (typeof value !== 'number' || Number.isNaN(value)) {
      return [
        `${formatPath(pathSegments)} should be a number, got ${getTypeName(value)}`,
      ]
    }

    return errors
  }

  if (schema.type === 'boolean') {
    if (typeof value !== 'boolean') {
      return [
        `${formatPath(pathSegments)} should be a boolean, got ${getTypeName(value)}`,
      ]
    }

    return errors
  }

  if (schema.type === 'string') {
    if (typeof value !== 'string') {
      return [
        `${formatPath(pathSegments)} should be a string, got ${getTypeName(value)}`,
      ]
    }

    return errors
  }

  return errors
}

const validateConfigFile = async (fileName, schema) => {
  const filePath = path.join(configDir, fileName)
  const source = await readFile(filePath, 'utf8')
  const parsed = parse(source) ?? {}
  const errors = validateAgainstSchema(parsed, schema)

  if (errors.length > 0) {
    throw new Error(
      `${fileName}\n${errors.map((error) => `  - ${error}`).join('\n')}`,
    )
  }
}

const main = async () => {
  const schema = JSON.parse(await readFile(schemaPath, 'utf8'))
  const fileNames = (await readdir(configDir))
    .filter((fileName) => fileName.endsWith('.yml'))
    .sort((a, b) => a.localeCompare(b))

  const failures = []

  for (const fileName of fileNames) {
    try {
      await validateConfigFile(fileName, schema)
    } catch (error) {
      failures.push(error instanceof Error ? error.message : String(error))
    }
  }

  if (failures.length > 0) {
    console.error('Config schema validation failed:')
    console.error(failures.join('\n'))
    process.exit(1)
  }

  console.log(
    `Validated ${fileNames.length} config file(s) against ${path.relative(rootDir, schemaPath)}.`,
  )
}

await main()
