"""Generate unique fictional demo profile photos via Gemini Nano Banana.
Post-process: square crop, resize 1000px + 256px thumb, JPEG re-encode (strips all metadata/GPS).
Writes manifest to /app/memory/demo_assets_manifest.json. Idempotent: skips existing files.
"""
import asyncio, base64, io, json, os, sys
from dotenv import load_dotenv

load_dotenv("/app/backend/.env")
from emergentintegrations.llm.chat import LlmChat, UserMessage  # noqa: E402
from PIL import Image  # noqa: E402

OUT = "/app/backend/static/demo-assets"
MANIFEST = "/app/memory/demo_assets_manifest.json"
os.makedirs(OUT, exist_ok=True)

# (asset_id, name, gender, age, setting/context)
PEOPLE = [
    ("kauri", "Kauri", "man", 28, "standing on a golf course in the late afternoon, polo shirt, friendly confident smile"),
    ("james", "James", "man", 31, "in a modern fintech office lounge, casual blazer over t-shirt, relaxed"),
    ("sarah", "Sarah", "woman", 24, "sitting in a quiet cafe corner with a notebook, thoughtful gentle smile"),
    ("olivia", "Olivia", "woman", 28, "holding a takeaway coffee on a city laneway, warm smile, smart casual"),
    ("jake", "Jake", "man", 29, "at an outdoor cafe table, headphones around neck, easy grin"),
    ("mia", "Mia", "woman", 26, "on a coastal walking trail at golden hour, activewear jacket, natural laugh"),
    ("liam", "Liam", "man", 30, "in a gym setting resting after a workout, athletic build, towel over shoulder"),
    ("sophie", "Sophie", "woman", 29, "at a weekend farmers market holding flowers, denim jacket, cheerful"),
    ("ryan", "Ryan", "man", 35, "leaning on a bridge railing by a river at dusk, light sweater, calm expression"),
    ("emily", "Emily", "woman", 27, "in a bookshop aisle holding a paperback, cardigan, soft smile"),
    ("alexdemo", "Alex (Demo)", "man", 29, "in a bright coworking space, casual shirt, approachable neutral smile"),
    ("maya", "Maya", "woman", 27, "on a park bench with a takeaway tea, slightly pensive but warm"),
    ("tom", "Tom", "man", 30, "approachable accountant in an office doorway, business casual, no tie"),
    ("ava", "Ava", "woman", 25, "at a street art laneway, tote bag, candid mid-smile"),
    ("lucas", "Lucas", "man", 35, "business consultant at a cafe meeting table with a laptop closed, open collar shirt"),
    ("grace", "Grace", "woman", 28, "young lawyer on courthouse steps, blazer, composed friendly look"),
    ("oscar", "Oscar", "man", 31, "marketing consultant in a creative studio with mood boards behind, smart casual"),
    ("ruby", "Ruby", "woman", 24, "at an outdoor music event in daylight, festival lanyard, laughing naturally"),
    ("aria", "Aria", "woman", 27, "graphic designer at a desk with a drawing tablet, creative studio light, glasses"),
    ("finn", "Finn", "man", 30, "walking a dog in a leafy park, hoodie, candid look at camera"),
    ("theo", "Theo", "man", 33, "consultant in a hotel lobby lounge, navy knit, relaxed professional"),
    ("poppy", "Poppy", "woman", 22, "university courtyard with a backpack, bright genuine smile"),
    ("arlo", "Arlo", "man", 23, "skate park edge at sunset holding a skateboard, beanie, easygoing"),
    ("daisy", "Daisy", "woman", 24, "cafe barista side of counter on a break, apron, friendly"),
    ("felix", "Felix", "man", 25, "young electrician beside a work van, hi-vis vest over t-shirt, honest smile"),
    ("hazel", "Hazel", "woman", 26, "community garden holding a small plant, straw hat, natural light"),
    ("jasper", "Jasper", "man", 27, "builder on a timber-frame site, hard hat under arm, warm grin"),
    ("luna", "Luna", "woman", 28, "photographer holding a DSLR camera on a city street, artistic casual outfit"),
    ("ezra", "Ezra", "man", 24, "personal trainer in an outdoor bootcamp park setting, athletic top, energetic"),
    ("iris", "Iris", "woman", 25, "photographer editing at a laptop in a bright loft, camera on table beside"),
    ("dev", "Dev", "man", 29, "software engineer at a standing desk with code on a blurred monitor, t-shirt"),
    ("sana", "Sana", "woman", 31, "HR consultant in a bright meeting room, blouse, welcoming expression"),
    ("jade", "Jade", "woman", 26, "personal trainer in a gym studio with kettlebells blurred behind, ponytail"),
    ("priya", "Priya", "woman", 34, "at a networking event with a name badge, blazer, engaging smile"),
    ("matilda", "Matilda", "woman", 28, "mortgage broker outside a suburban open-home, folder in hand, professional friendly"),
    ("rory", "Rory", "man", 25, "IT consultant in a server-room doorway, polo shirt, glasses, mild smile"),
]

PROMPT = (
    "Photorealistic candid smartphone-quality profile photo of a fictional {age}-year-old {gender}, "
    "{setting}. Natural lighting, realistic skin texture, relaxed natural expression, head and shoulders "
    "clearly visible and centered enough for a circular avatar crop, contemporary everyday clothing, "
    "realistic background with soft depth of field, square 1:1 composition. This is a completely fictional "
    "person who must clearly appear to be an adult over 18. No text, no watermark, no logos, no celebrity likeness."
)


def post_process(raw: bytes, asset_id: str):
    img = Image.open(io.BytesIO(raw)).convert("RGB")
    w, h = img.size
    s = min(w, h)
    img = img.crop(((w - s) // 2, (h - s) // 2, (w + s) // 2, (h + s) // 2))
    full = img.resize((1000, 1000), Image.LANCZOS)
    thumb = img.resize((256, 256), Image.LANCZOS)
    fp, tp = f"{OUT}/{asset_id}.jpg", f"{OUT}/{asset_id}_thumb.jpg"
    full.save(fp, "JPEG", quality=84)   # PIL re-encode strips all EXIF/GPS metadata
    thumb.save(tp, "JPEG", quality=82)
    return fp, tp


async def gen_one(asset_id, name, gender, age, setting):
    fp = f"{OUT}/{asset_id}.jpg"
    if os.path.isfile(fp):
        print(f"skip {asset_id} (exists)", flush=True)
        return True
    chat = LlmChat(api_key=os.environ["EMERGENT_LLM_KEY"], session_id=f"demo-photo-{asset_id}",
                   system_message="You generate photorealistic fictional portrait photos.")
    chat.with_model("gemini", "gemini-3.1-flash-image-preview").with_params(modalities=["image", "text"])
    msg = UserMessage(text=PROMPT.format(age=age, gender=gender, setting=setting))
    for attempt in range(3):
        try:
            _, images = await chat.send_message_multimodal_response(msg)
            if images:
                raw = base64.b64decode(images[0]["data"])
                post_process(raw, asset_id)
                print(f"OK {asset_id} ({len(raw)//1024}KB raw)", flush=True)
                return True
            print(f"no image for {asset_id}, attempt {attempt+1}", flush=True)
        except Exception as e:
            print(f"ERR {asset_id} attempt {attempt+1}: {str(e)[:120]}", flush=True)
            await asyncio.sleep(4)
    return False


async def main():
    results = {}
    for row in PEOPLE:
        ok = await gen_one(*row)
        results[row[0]] = ok
    manifest = []
    for asset_id, name, gender, age, setting in PEOPLE:
        exists = os.path.isfile(f"{OUT}/{asset_id}.jpg")
        manifest.append({
            "demo_user_id": asset_id, "profile_name": name, "apparent_age": age,
            "source_asset": f"/api/demo-assets/{asset_id}.jpg",
            "thumbnail_asset": f"/api/demo-assets/{asset_id}_thumb.jpg",
            "image_version": 1,
            "source_type": "ai_generated_fictional (Gemini Nano Banana)",
            "commercial_rights": "AI-generated fictional person created for Orrbbit demo use",
            "approval_status": "pending_owner_review",
            "generated": exists, "prompt_context": setting,
            "metadata_stripped": True,
        })
    with open(MANIFEST, "w") as f:
        json.dump(manifest, f, indent=2)
    failed = [k for k, v in results.items() if not v]
    print(f"DONE. {len(results)-len(failed)}/{len(results)} generated. Failed: {failed}", flush=True)

if __name__ == "__main__":
    asyncio.run(main())
