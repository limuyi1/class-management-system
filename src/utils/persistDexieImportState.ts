let databaseImporting = false

export const setDatabaseImporting = (value: boolean) => {
  databaseImporting = value
}

export const isDatabaseImporting = () => databaseImporting
