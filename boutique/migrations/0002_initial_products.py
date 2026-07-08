from django.db import migrations


INITIAL_PRODUCTS = [
    {
        'nom': 'Cire Mate Signature',
        'categorie': 'COIFFANT',
        'description': 'Tenue forte, fini mat naturel. La cire des habitués de WilloBarber.',
        'prix': 18,
        'contenance': '75 ml',
        'photo_url': 'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?w=400&q=80',
        'stock': 50,
        'actif': True,
    },
    {
        'nom': 'Huile Barbe Cèdre',
        'categorie': 'SOIN BARBE',
        'description': 'Huile nourrissante au cèdre et à la jojoba. Barbe douce, peau apaisée.',
        'prix': 24,
        'contenance': '30 ml',
        'photo_url': 'https://images.unsplash.com/photo-1599351431202-1e0f0137899a?w=400&q=80',
        'stock': 30,
        'actif': True,
    },
    {
        'nom': 'Sérum Visage',
        'categorie': 'SOIN VISAGE',
        'description': 'Hydratation profonde, anti-fatigue. Geste quotidien, résultat visible.',
        'prix': 32,
        'contenance': '30 ml',
        'photo_url': 'https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?w=400&q=80',
        'stock': 25,
        'actif': True,
    },
    {
        'nom': 'Pomade Brillante',
        'categorie': 'STYLING',
        'description': 'Look rétro, tenue souple et brillance contrôlée. Effet coiffeur à la maison.',
        'prix': 20,
        'contenance': '100 ml',
        'photo_url': 'https://images.unsplash.com/photo-1621605815971-fbc98d665033?w=400&q=80',
        'stock': 40,
        'actif': True,
    },
]


def create_initial_products(apps, schema_editor):
    Product = apps.get_model('boutique', 'Product')
    for data in INITIAL_PRODUCTS:
        Product.objects.get_or_create(nom=data['nom'], defaults=data)


def delete_initial_products(apps, schema_editor):
    Product = apps.get_model('boutique', 'Product')
    Product.objects.filter(nom__in=[p['nom'] for p in INITIAL_PRODUCTS]).delete()


class Migration(migrations.Migration):

    dependencies = [
        ('boutique', '0001_initial'),
    ]

    operations = [
        migrations.RunPython(create_initial_products, delete_initial_products),
    ]
