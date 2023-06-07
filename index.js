const express = require('express');
const app = express()
const cors = require('cors')
require('dotenv').config()
const port = process.env.PORT || 9000;


app.use(cors())
app.use(express.json())


app.get('/', (req, res)=>{
    res.send('Summer camp school is starting')
})

app.listen(port, ()=>{
    console.log(`Summer port is running ${port}`)
})