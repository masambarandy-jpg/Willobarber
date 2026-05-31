import imghdr
from django.core.exceptions import ValidationError

MAX_UPLOAD_SIZE_MB = 5
ALLOWED_IMAGE_TYPES = ('jpeg', 'png', 'webp')


def validate_image_file(file):
    if file.size > MAX_UPLOAD_SIZE_MB * 1024 * 1024:
        raise ValidationError(
            f"La taille du fichier ne doit pas dépasser {MAX_UPLOAD_SIZE_MB} Mo."
        )
    file_type = imghdr.what(file)
    if file_type not in ALLOWED_IMAGE_TYPES:
        raise ValidationError(
            f"Format non supporté. Utilisez : {', '.join(ALLOWED_IMAGE_TYPES)}."
        )
