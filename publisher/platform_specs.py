"""Specs de cada plataforma — formato, duração, aspect ratio, limites.

Cada plataforma tem suas regras. Este módulo centraliza tudo
pra o video_builder gerar no formato correto.
"""

PLATFORM_SPECS = {
    "tiktok": {
        "name": "TikTok",
        "max_duration": 180,  # 3 min
        "ideal_duration": (15, 60),  # sweet spot
        "aspect_ratio": "9:16",
        "resolution": (1080, 1920),
        "max_file_size_mb": 287,
        "video_codec": "h264",
        "audio_codec": "aac",
        "fps": 30,
        "caption_max_chars": 2200,
        "hashtags_max": 10,
        "supports_music": True,
        "supports_subtitles": True,
        "best_post_times": ["07:00", "12:00", "17:00", "21:00"],
    },
    "instagram": {
        "name": "Instagram Reels",
        "max_duration": 90,  # 90s pra Reels
        "ideal_duration": (15, 60),
        "aspect_ratio": "9:16",
        "resolution": (1080, 1920),
        "max_file_size_mb": 250,
        "video_codec": "h264",
        "audio_codec": "aac",
        "fps": 30,
        "caption_max_chars": 2200,
        "hashtags_max": 30,
        "supports_music": True,
        "supports_subtitles": True,
        "best_post_times": ["08:00", "13:00", "19:00", "21:00"],
    },
    "youtube": {
        "name": "YouTube Shorts",
        "max_duration": 60,  # 60s pra Shorts
        "ideal_duration": (15, 58),
        "aspect_ratio": "9:16",
        "resolution": (1080, 1920),
        "max_file_size_mb": 256,
        "video_codec": "h264",
        "audio_codec": "aac",
        "fps": 30,
        "caption_max_chars": 100,  # título
        "description_max_chars": 5000,
        "hashtags_max": 15,
        "supports_music": False,  # YouTube tem copyright mais rígido
        "supports_subtitles": True,
        "best_post_times": ["10:00", "14:00", "18:00", "20:00"],
    },
    "twitter": {
        "name": "Twitter/X",
        "max_duration": 140,  # 2:20
        "ideal_duration": (15, 60),
        "aspect_ratio": "9:16",  # vertical performa melhor
        "resolution": (720, 1280),  # menor que outros
        "max_file_size_mb": 512,
        "video_codec": "h264",
        "audio_codec": "aac",
        "fps": 30,
        "caption_max_chars": 280,
        "hashtags_max": 3,
        "supports_music": True,
        "supports_subtitles": True,
        "best_post_times": ["08:00", "12:00", "17:00", "21:00"],
    },
    "telegram": {
        "name": "Telegram",
        "max_duration": 600,  # 10 min
        "ideal_duration": (15, 120),
        "aspect_ratio": "9:16",
        "resolution": (1080, 1920),
        "max_file_size_mb": 50,
        "video_codec": "h264",
        "audio_codec": "aac",
        "fps": 25,
        "caption_max_chars": 1024,
        "hashtags_max": 0,
        "supports_music": True,
        "supports_subtitles": True,
        "best_post_times": ["09:00", "13:00", "19:00"],
    },
}


def get_specs(platform: str) -> dict:
    return PLATFORM_SPECS.get(platform, PLATFORM_SPECS["tiktok"])


def get_all_platforms() -> list[str]:
    return list(PLATFORM_SPECS.keys())


def validate_clip_for_platform(duration: int, file_size_mb: float, platform: str) -> dict:
    """Valida se um clip atende os requisitos da plataforma."""
    specs = get_specs(platform)
    issues = []

    if duration > specs["max_duration"]:
        issues.append(f"Duracao {duration}s excede max {specs['max_duration']}s")
    if file_size_mb > specs["max_file_size_mb"]:
        issues.append(f"Arquivo {file_size_mb:.1f}MB excede max {specs['max_file_size_mb']}MB")

    ideal_min, ideal_max = specs["ideal_duration"]
    is_ideal = ideal_min <= duration <= ideal_max

    return {
        "valid": len(issues) == 0,
        "ideal": is_ideal,
        "issues": issues,
        "platform": platform,
        "specs": specs,
    }
