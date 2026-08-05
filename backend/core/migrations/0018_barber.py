from django.db import migrations, models


# app/coiffeur/equipe.tsx affichait jusqu'ici une équipe 100% en dur
# (INITIAL_TEAM), sans aucun appel API : toute modification (nom, rôle...)
# était perdue au changement d'onglet. On seed ici les 3 membres déjà connus
# côté frontend pour que l'écran continue d'afficher la même équipe une fois
# branché sur ce nouveau modèle.
SEED_BARBERS = [
    {'name': 'Willo Diallo', 'role': 'Fondateur & Master Barber', 'status': 'Actif',
     'email': 'willo@willobarber.fr', 'phone': '06 45 78 29 70',
     'specialties': ['Fade', 'Texturé', 'Rasoir']},
    {'name': 'Malik Haddad', 'role': 'Barbier Senior', 'status': 'Actif',
     'email': 'malik@willobarber.fr', 'phone': '06 32 11 45 67',
     'specialties': ['Barbe', 'Rasage', 'Classique']},
    {'name': 'Idris Camara', 'role': 'Barbier & Coloriste', 'status': 'Absent',
     'email': 'idris@willobarber.fr', 'phone': '06 78 90 12 34',
     'specialties': ['Color', 'Crop', 'Soin']},
]


def seed_barbers(apps, schema_editor):
    Barber = apps.get_model('core', 'Barber')
    if Barber.objects.exists():
        return
    for data in SEED_BARBERS:
        Barber.objects.create(**data)


def noop_reverse(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0017_service_category'),
    ]

    operations = [
        migrations.CreateModel(
            name='Barber',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=100)),
                ('role', models.CharField(blank=True, default='Barbier', max_length=100)),
                ('status', models.CharField(choices=[('Actif', 'Actif'), ('Absent', 'Absent')], default='Actif', max_length=20)),
                ('email', models.EmailField(blank=True, default='', max_length=254)),
                ('phone', models.CharField(blank=True, default='', max_length=30)),
                ('specialties', models.JSONField(blank=True, default=list)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
            ],
            options={
                'ordering': ['id'],
            },
        ),
        migrations.RunPython(seed_barbers, noop_reverse),
    ]
