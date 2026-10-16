import type { Environment } from '../types/api'

const SECRET_KEY_PATTERN = /token|secret|password|api[_-]?key|authorization/i

export function isSecretVariable(variable: { key: string; secret?: boolean }): boolean {
  return Boolean(variable.secret) || SECRET_KEY_PATTERN.test(variable.key)
}

export function sanitizeEnvironments(environments: Environment[]): Environment[] {
  return environments.map((environment) => ({
    ...environment,
    variables: environment.variables.map((variable) =>
      isSecretVariable(variable) ? { ...variable, secret: true, value: '' } : { ...variable }
    )
  }))
}

export function applyLocalSecrets(remote: Environment[], local: Environment[]): Environment[] {
  const localValues = new Map<string, string>()
  local.forEach((environment) => {
    environment.variables.forEach((variable) => {
      if (isSecretVariable(variable)) localValues.set(`${environment.name}::${variable.key}`, variable.value)
    })
  })

  return remote.map((environment) => ({
    ...environment,
    variables: environment.variables.map((variable) => {
      if (isSecretVariable(variable)) {
        const key = `${environment.name}::${variable.key}`
        return { ...variable, secret: true, value: localValues.get(key) ?? '' }
      }
      return variable
    })
  }))
}
