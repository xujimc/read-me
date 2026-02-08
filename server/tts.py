import os
import base64
import requests
from elevenlabs.client import ElevenLabs

client = ElevenLabs(api_key=os.getenv("ELEVENLABS_API_KEY"))

# Default voice - can be changed to any ElevenLabs voice ID
DEFAULT_VOICE_ID = "JBFqnCBsd6RMkjVDRZzb"  # George - warm, narrative voice


def get_stt_token() -> str:
    """
    Generate a single-use token for ElevenLabs real-time STT.
    Token expires after 15 minutes and is consumed on use.
    """
    api_key = os.getenv("ELEVENLABS_API_KEY")
    response = requests.post(
        "https://api.elevenlabs.io/v1/single-use-token/realtime_scribe",
        headers={"xi-api-key": api_key},
    )
    response.raise_for_status()
    return response.json()["token"]


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
