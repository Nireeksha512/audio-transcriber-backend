const express = require('express');
const multer = require('multer');
const fs = require('fs');
const axios = require('axios');

require('dotenv').config();

const router = express.Router();
const supabase=require('../supabaseClient');
const { error } = require('console');

// Set up Multer to store uploaded files in "uploads/" folder
const upload = multer({ dest: 'uploads/' });

router.post('/transcribe', upload.single('audio'), async (req, res) => {
  try {
    const audioPath = req.file.path;

    // Step 1: Upload the audio to AssemblyAI
    const uploadResponse = await axios({
      method: 'post',
      url: 'https://api.assemblyai.com/v2/upload',
      headers: {
        authorization: process.env.ASSEMBLYAI_API_KEY,
        'transfer-encoding': 'chunked',
      },
      data: fs.createReadStream(audioPath),
    });

    const audioUrl = uploadResponse.data.upload_url;

    // Step 2: Request transcription
    const transcriptResponse = await axios({
      method: 'post',
      url: 'https://api.assemblyai.com/v2/transcript',
      headers: {
        authorization: process.env.ASSEMBLYAI_API_KEY,
        'content-type': 'application/json',
      },
      data: {
        audio_url: audioUrl,
      },
    });

    const transcriptId = transcriptResponse.data.id;

    // Step 3: Poll for the transcription result
    let status = 'processing';
    let transcriptText = '';

    while (status === 'processing' || status === 'queued') {
      await new Promise((resolve) => setTimeout(resolve, 3000)); // wait 3 seconds

      const pollingResponse = await axios({
        method: 'get',
        url: `https://api.assemblyai.com/v2/transcript/${transcriptId}`,
        headers: {
          authorization: process.env.ASSEMBLYAI_API_KEY,
        },
      });

      status = pollingResponse.data.status;

      if (status === 'completed') {
        transcriptText = pollingResponse.data.text;
        const { data,error:dbError}=await supabase.from('transcriptions').insert([
          {
            filename: req.file.originalname,
            transcription:transcriptText,
            created_at:new Date().toISOString(),
          },
        ]);

        if(dbError)
        {
          console.error('supabase insert error',dbError.message);
        }
        else{
          console.log('Inserted into supabase:',data);
        }




      } else if (status === 'error') {
        throw new Error('Transcription failed at AssemblyAI');
      }
    }

    res.json({ transcription: transcriptText });

    // Delete the file after processing
    fs.unlink(audioPath, (err) => {
      if (err) console.error('Error deleting file:', err);
    });
  } catch (error) {
    console.error('Error in /api/transcribe:', error.message);
    res.status(500).json({ error: 'Transcription failed' });
  }
});

router.get('/transcriptions',async(req,res)=>
{
  try{
    const {data,error}=await supabase.from('transcriptions')
    .select('*')
    
    if(error)
    {
      console.error('supabase fetch error:',error.message);
      return res.status(500).json({error:'Failed to fetch transcriptions'});
    }
    console.log('fetched from supabase:',data);
    res.json(data);
  }
  catch(err){
    console.error('server error:',err);
    res.status(500).json({error:'server error'});
  }
});



module.exports = router;