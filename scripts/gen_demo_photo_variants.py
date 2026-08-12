"""Generate 2 same-person variant photos for each core demo persona via Gemini
Nano Banana image editing (base portrait as input → same fictional person, new setting).
Idempotent: skips existing files. Output: {asset}2.jpg / {asset}3.jpg + thumbs.
"""
import asyncio, base64, io, os, sys
from dotenv import load_dotenv

load_dotenv("/app/backend/.env")
from emergentintegrations.llm.chat import LlmChat, UserMessage, ImageContent  # noqa: E402
from PIL import Image  # noqa: E402

OUT = "/app/backend/static/demo-assets"

# (asset_id, [variant settings])
VARIANTS = {
    "kauri": ["mid-swing follow-through on a golf fairway, smiling", "casual dinner table with friends out of frame, laughing"],
    "james": ["presenting at a whiteboard in a startup office, animated", "trail running by a river path, athletic wear"],
    "sarah": ["walking through a leafy university campus with a tote bag", "laughing at an outdoor food market stall"],
    "olivia": ["at a rooftop networking event at dusk holding a drink", "browsing records at a weekend market"],
    "jake": ["mixing audio at a small live venue desk, focused smile", "riding a bicycle along a beach path, casual"],
    "mia": ["stretching in a park before a run, morning light", "cooking in a bright kitchen, laughing candidly"],
    "liam": ["coaching a client with battle ropes in a gym, energetic", "hiking a coastal lookout with a daypack"],
    "sophie": ["sketching in a sunny cafe window seat, focused", "at a gallery opening, glass of sparkling water"],
    "ryan": ["walking out of a small business storefront, keys in hand", "at a golf driving range at sunset"],
    "emily": ["writing notes at a busy brunch spot, coffee beside", "photographing a food stall at a night market"],
}

EDIT_PROMPT = (
    "Using the person in the attached photo, generate a new photorealistic candid smartphone-quality photo of the "
    "EXACT SAME fictional person — identical face, hair, age and build — now {setting}. Different outfit is fine. "
    "Natural lighting, realistic skin texture, square 1:1 composition, person clearly visible. This is a completely "
    "fictional adult over 18. No text, no watermark, no logos, no celebrity likeness."
)


def post_process(raw: bytes, fname: str):
    img = Image.open(io.BytesIO(raw)).convert("RGB")
    w, h = img.size
    s = min(w, h)
    img = img.crop(((w - s) // 2, (h - s) // 2, (w + s) // 2, (h + s) // 2))
    img.resize((1000, 1000), Image.LANCZOS).save(f"{OUT}/{fname}.jpg", "JPEG", quality=84)
    img.resize((256, 256), Image.LANCZOS).save(f"{OUT}/{fname}_thumb.jpg", "JPEG", quality=82)


async def gen_variant(asset_id: str, idx: int, setting: str) -> bool:
    fname = f"{asset_id}{idx}"
    if os.path.isfile(f"{OUT}/{fname}.jpg"):
        print(f"skip {fname} (exists)", flush=True)
        return True
    base_path = f"{OUT}/{asset_id}.jpg"
    if not os.path.isfile(base_path):
        print(f"no base for {asset_id}", flush=True)
        return False
    with open(base_path, "rb") as f:
        base_b64 = base64.b64encode(f.read()).decode()
    chat = LlmChat(api_key=os.environ["EMERGENT_LLM_KEY"], session_id=f"demo-var-{fname}",
                   system_message="You generate photorealistic fictional portrait photos.")
    chat.with_model("gemini", "gemini-3.1-flash-image-preview").with_params(modalities=["image", "text"])
    msg = UserMessage(text=EDIT_PROMPT.format(setting=setting),
                      file_contents=[ImageContent(image_base64=base_b64)])
    for attempt in range(3):
        try:
            _, images = await chat.send_message_multimodal_response(msg)
            if images:
                post_process(base64.b64decode(images[0]["data"]), fname)
                print(f"OK {fname}", flush=True)
                return True
            print(f"no image {fname} attempt {attempt+1}", flush=True)
        except Exception as e:
            print(f"ERR {fname} attempt {attempt+1}: {str(e)[:120]}", flush=True)
            await asyncio.sleep(4)
    return False


async def main():
    fails = []
    for asset_id, settings in VARIANTS.items():
        for i, setting in enumerate(settings, start=2):
            if not await gen_variant(asset_id, i, setting):
                fails.append(f"{asset_id}{i}")
    print("DONE. fails:", fails or "none", flush=True)


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
