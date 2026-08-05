from django.db import migrations, models


# Le champ 'category' n'a jamais existé sur ce modèle Service (déployé sur
# Railway) : le catalogue mobile ne recevait donc jamais de vraie valeur et
# retombait silencieusement sur 'COUPE HOMME' pour tout, ce qui vidait tous
# les filtres sauf "Coupe". On assigne ici la bonne catégorie aux prestations
# déjà en base, en se basant sur leur nom (seul champ fiable disponible).
NAME_TO_CATEGORY = {
    'Signature WilloBarber': 'package',
    'Taille & rasage': 'barbe',
    'Le Rituel': 'package',
    'Coupe express': 'coupe_homme',
    'Camouflage gris': 'coloration',
    'Soin visage': 'soin',
    'Coupe enfant -15': 'enfant',
    'Coupe enfant +15': 'enfant',
}


def set_existing_categories(apps, schema_editor):
    Service = apps.get_model('core', 'Service')
    for name, category in NAME_TO_CATEGORY.items():
        Service.objects.filter(name=name).update(category=category)


def noop_reverse(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0016_reservation_unique_active_reservation_slot'),
    ]

    operations = [
        migrations.AddField(
            model_name='service',
            name='category',
            field=models.CharField(
                choices=[
                    ('coupe_homme', 'Coupe Homme'),
                    ('barbe', 'Barbe'),
                    ('package', 'Package'),
                    ('coloration', 'Coloration'),
                    ('soin', 'Soin'),
                    ('enfant', 'Enfant'),
                ],
                default='coupe_homme',
                max_length=30,
            ),
        ),
        migrations.RunPython(set_existing_categories, noop_reverse),
    ]
