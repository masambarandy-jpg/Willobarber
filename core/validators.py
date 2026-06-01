import struct
from django.core.exceptions import ValidationError


def validate_image_file(file):
    allowed_types = [
        b'\xff\xd8\xff',  # JPEG
        b'\x89PNG',       # PNG
        b'RIFF',          # WEBP
    ]
    file.seek(0)
    header = file.read(4)
    file.seek(0)
    if not any(header.startswith(sig) for sig in allowed_types):
        raise ValidationError("Format non supporté. Utilisez JPEG, PNG ou WebP.")
    if file.size > 5 * 1024 * 1024:
        raise ValidationError("Fichier trop volumineux. Maximum 5 Mo.")
