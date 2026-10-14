from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0023_user_deletion_reason'),
    ]

    operations = [
        migrations.AddField(
            model_name='user',
            name='loyalty_points',
            field=models.IntegerField(default=0),
        ),
    ]
