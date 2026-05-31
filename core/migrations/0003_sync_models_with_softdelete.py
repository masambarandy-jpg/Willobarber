from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion
import django.utils.timezone


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0002_barbershop_service_reservation'),
    ]

    operations = [
        # Remove old outdated models first (drop in dependency order)
        migrations.DeleteModel(name='Reservation'),
        migrations.DeleteModel(name='Service'),
        migrations.DeleteModel(name='Barbershop'),

        # Add missing fields to User
        migrations.AddField(
            model_name='user',
            name='is_deleted',
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name='user',
            name='deleted_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='user',
            name='profile_picture',
            field=models.ImageField(blank=True, null=True, upload_to='profiles/'),
        ),
        migrations.AddField(
            model_name='user',
            name='language',
            field=models.CharField(
                choices=[('fr', 'Français'), ('nl', 'Nederlands'), ('en', 'English')],
                default='fr',
                max_length=5,
            ),
        ),
        migrations.AddField(
            model_name='user',
            name='dark_mode',
            field=models.BooleanField(default=True),
        ),
        migrations.AddField(
            model_name='user',
            name='ai_recommendations',
            field=models.BooleanField(default=True),
        ),
        migrations.AddField(
            model_name='user',
            name='created_at',
            field=models.DateTimeField(auto_now_add=True, default=django.utils.timezone.now),
            preserve_default=False,
        ),
        migrations.AddField(
            model_name='user',
            name='updated_at',
            field=models.DateTimeField(auto_now=True),
        ),
        migrations.AddField(
            model_name='user',
            name='late_cancellations',
            field=models.IntegerField(default=0),
        ),
        migrations.AddField(
            model_name='user',
            name='loyalty_points',
            field=models.IntegerField(default=0),
        ),
        migrations.AlterField(
            model_name='user',
            name='role',
            field=models.CharField(
                choices=[('client', 'Client'), ('barber', 'Barbier'), ('admin', 'Admin')],
                default='client',
                max_length=20,
            ),
        ),

        # Create Barber model
        migrations.CreateModel(
            name='Barber',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('is_deleted', models.BooleanField(default=False)),
                ('deleted_at', models.DateTimeField(blank=True, null=True)),
                ('title', models.CharField(blank=True, max_length=100)),
                ('bio', models.TextField(blank=True)),
                ('specialties', models.JSONField(default=list)),
                ('experience_years', models.IntegerField(default=0)),
                ('color', models.CharField(default='#C9A84C', max_length=7)),
                ('is_active', models.BooleanField(default=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('user', models.OneToOneField(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='barber_profile',
                    to=settings.AUTH_USER_MODEL,
                )),
            ],
        ),

        # Create new Service model
        migrations.CreateModel(
            name='Service',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('is_deleted', models.BooleanField(default=False)),
                ('deleted_at', models.DateTimeField(blank=True, null=True)),
                ('name', models.CharField(max_length=100)),
                ('description', models.TextField(blank=True)),
                ('category', models.CharField(
                    choices=[
                        ('coupe_homme', 'Coupe Homme'),
                        ('barbe', 'Barbe'),
                        ('package', 'Package'),
                        ('coloration', 'Coloration'),
                        ('soin', 'Soin'),
                        ('enfant', 'Enfant'),
                    ],
                    max_length=30,
                )),
                ('price', models.DecimalField(decimal_places=2, max_digits=6)),
                ('duration', models.IntegerField(help_text='Durée en minutes')),
                ('is_popular', models.BooleanField(default=False)),
                ('status', models.CharField(
                    choices=[('active', 'Actif'), ('draft', 'Brouillon'), ('inactive', 'Inactif')],
                    default='active',
                    max_length=20,
                )),
                ('image', models.ImageField(blank=True, null=True, upload_to='services/')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
            ],
        ),

        # Create new Reservation model
        migrations.CreateModel(
            name='Reservation',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('is_deleted', models.BooleanField(default=False)),
                ('deleted_at', models.DateTimeField(blank=True, null=True)),
                ('reference', models.CharField(blank=True, max_length=20, unique=True)),
                ('date', models.DateField()),
                ('start_time', models.TimeField()),
                ('end_time', models.TimeField()),
                ('status', models.CharField(
                    choices=[
                        ('pending', 'En attente'),
                        ('confirmed', 'Confirmé'),
                        ('completed', 'Terminé'),
                        ('cancelled_client', 'Annulé par client'),
                        ('cancelled_barber', 'Annulé par barbier'),
                        ('no_show', 'Non présenté'),
                    ],
                    default='pending',
                    max_length=30,
                )),
                ('payment_status', models.CharField(
                    choices=[
                        ('unpaid', 'Non payé'),
                        ('deposit_paid', 'Acompte payé'),
                        ('fully_paid', 'Entièrement payé'),
                        ('refunded', 'Remboursé'),
                    ],
                    default='unpaid',
                    max_length=20,
                )),
                ('deposit_amount', models.DecimalField(decimal_places=2, default=10.0, max_digits=6)),
                ('total_amount', models.DecimalField(decimal_places=2, max_digits=6)),
                ('notes', models.TextField(blank=True)),
                ('cancellation_reason', models.TextField(blank=True)),
                ('is_walk_in', models.BooleanField(default=False)),
                ('person_count', models.IntegerField(default=1)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('client', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='reservations',
                    to=settings.AUTH_USER_MODEL,
                )),
                ('barber', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='reservations',
                    to='core.barber',
                )),
                ('service', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    to='core.service',
                )),
                ('cancelled_by', models.ForeignKey(
                    blank=True,
                    null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='cancelled_reservations',
                    to=settings.AUTH_USER_MODEL,
                )),
            ],
        ),

        # Create Availability model
        migrations.CreateModel(
            name='Availability',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('date', models.DateField()),
                ('start_time', models.TimeField()),
                ('end_time', models.TimeField()),
                ('is_available', models.BooleanField(default=True)),
                ('barber', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='availabilities',
                    to='core.barber',
                )),
            ],
            options={'unique_together': {('barber', 'date', 'start_time')}},
        ),

        # Create SlotLock model
        migrations.CreateModel(
            name='SlotLock',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('date', models.DateField()),
                ('start_time', models.TimeField()),
                ('locked_until', models.DateTimeField()),
                ('is_forced', models.BooleanField(default=False)),
                ('barber', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    to='core.barber',
                )),
                ('locked_by', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    to=settings.AUTH_USER_MODEL,
                )),
            ],
            options={'unique_together': {('barber', 'date', 'start_time')}},
        ),

        # Create ConsentLog model
        migrations.CreateModel(
            name='ConsentLog',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('consent_version', models.CharField(default='v1.0', max_length=20)),
                ('accepted_at', models.DateTimeField(auto_now_add=True)),
                ('ip_address', models.GenericIPAddressField(blank=True, null=True)),
                ('user_agent', models.TextField(blank=True)),
                ('user', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    to=settings.AUTH_USER_MODEL,
                )),
                ('reservation', models.ForeignKey(
                    blank=True,
                    null=True,
                    on_delete=django.db.models.deletion.CASCADE,
                    to='core.reservation',
                )),
            ],
        ),

        # Create Review model
        migrations.CreateModel(
            name='Review',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('is_deleted', models.BooleanField(default=False)),
                ('deleted_at', models.DateTimeField(blank=True, null=True)),
                ('rating', models.IntegerField(choices=[(1, 1), (2, 2), (3, 3), (4, 4), (5, 5)])),
                ('comment', models.TextField(blank=True)),
                ('reply', models.TextField(blank=True)),
                ('replied_at', models.DateTimeField(blank=True, null=True)),
                ('status', models.CharField(
                    choices=[('pending', 'En attente'), ('published', 'Publié'), ('rejected', 'Rejeté')],
                    default='published',
                    max_length=20,
                )),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('reservation', models.OneToOneField(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='review',
                    to='core.reservation',
                )),
                ('client', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    to=settings.AUTH_USER_MODEL,
                )),
                ('barber', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='reviews',
                    to='core.barber',
                )),
                ('replied_by', models.ForeignKey(
                    blank=True,
                    null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='review_replies',
                    to=settings.AUTH_USER_MODEL,
                )),
            ],
        ),

        # Create WaitingList model
        migrations.CreateModel(
            name='WaitingList',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('preferred_date', models.DateField()),
                ('preferred_time', models.TimeField(blank=True, null=True)),
                ('status', models.CharField(
                    choices=[
                        ('waiting', 'En attente'),
                        ('notified', 'Notifié'),
                        ('confirmed', 'Confirmé'),
                        ('expired', 'Expiré'),
                    ],
                    default='waiting',
                    max_length=20,
                )),
                ('notified_at', models.DateTimeField(blank=True, null=True)),
                ('confirmation_deadline', models.DateTimeField(blank=True, null=True)),
                ('position', models.IntegerField(default=0)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('client', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    to=settings.AUTH_USER_MODEL,
                )),
                ('service', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    to='core.service',
                )),
                ('barber', models.ForeignKey(
                    blank=True,
                    null=True,
                    on_delete=django.db.models.deletion.CASCADE,
                    to='core.barber',
                )),
            ],
        ),

        # Create SalonSettings model
        migrations.CreateModel(
            name='SalonSettings',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('booking_cutoff_hour', models.IntegerField(default=19)),
                ('min_booking_hours_ahead', models.IntegerField(default=3)),
                ('walk_in_slots_per_day', models.IntegerField(default=2)),
                ('same_day_surcharge', models.DecimalField(decimal_places=2, default=10.0, max_digits=6)),
                ('cancellation_free_hours', models.IntegerField(default=24)),
                ('max_late_cancellations', models.IntegerField(default=3)),
                ('waiting_list_confirmation_minutes', models.IntegerField(default=15)),
                ('rush_mode_active', models.BooleanField(default=False)),
                ('bookings_open', models.BooleanField(default=True)),
                ('rush_message_fr', models.TextField(default='Le salon est très chargé en ce moment.')),
                ('rush_message_nl', models.TextField(default='De salon is momenteel erg druk.')),
                ('rush_message_en', models.TextField(default='The salon is very busy right now.')),
                ('updated_at', models.DateTimeField(auto_now=True)),
            ],
            options={'verbose_name': 'Paramètres du salon'},
        ),
    ]
