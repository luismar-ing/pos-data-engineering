import 'dotenv/config'
import { Client } from 'pg'

console.log('DB_URL:', process.env.DB_URL)

const client = new Client({
    connectionString: process.env.DB_URL
})

client.connect()
    .then(() => {
        console.log('✅ Conexión exitosa a PostgreSQL')
        return client.query('SELECT current_user, current_database()')
    })
    .then(result => {
        console.log(result.rows)
    })
    .catch(error => {
        console.error('❌ Error:', error)
    })
    .finally(() => {
        client.end()
    })