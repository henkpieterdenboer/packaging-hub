export function formatUserName(user: {
  firstName: string
  middleName?: string | null
  lastName: string
}): string {
  return user.middleName
    ? `${user.firstName} ${user.middleName} ${user.lastName}`
    : `${user.firstName} ${user.lastName}`
}
