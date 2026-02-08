import os
import base64
from elevenlabs.client import ElevenLabs

client = ElevenLabs(api_key=os.getenv("ELEVENLABS_API_KEY"))

# Default voice - can be changed to any ElevenLabs voice ID
DEFAULT_VOICE_ID = "JBFqnCBsd6RMkjVDRZzb"  # George - warm, narrative voice


def text_to_speech(text: str, voice_id: str = DEFAULT_VOICE_ID) -> str:
    """
    Convert text to speech using ElevenLabs API.
    Returns base64-encoded MP3 audio.
    """
    audio_generator = client.text_to_speech.convert(
        text=text,
        voice_id=voice_id,
        model_id="eleven_flash_v2_5",
        output_format="mp3_44100_128",
    )

    # Collect all chunks from the generator
    audio_bytes = b"".join(audio_generator)

    return base64.b64encode(audio_bytes).decode("utf-8")
