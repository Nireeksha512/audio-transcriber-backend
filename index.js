require('dotenv').config();
const express=require('express');
const cors=require('cors');


const transcribeRoute=require("./routes/transcribe");
const fetchRoute=require('./routes/fetch');

const app=express();









app.use(cors());
app.use(express.json());
app.use("/api",transcribeRoute);

app.use('/api',fetchRoute)


const PORT=process.env.PORT||5000;



app.listen(PORT,'0.0.0.0',() => {
    console.log(`server running on http://localhost:${PORT}`);
});

