-- phpMyAdmin SQL Dump
-- version 5.2.3
-- https://www.phpmyadmin.net/
--
-- Hôte : localhost:8889
-- Généré le : mar. 21 juil. 2026 à 17:58
-- Version du serveur : 8.0.44
-- Version de PHP : 7.4.33

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Base de données : `willo_barber_db`
--

-- --------------------------------------------------------

--
-- Structure de la table `appointments`
--

CREATE TABLE `appointments` (
  `id` char(32) COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` varchar(15) COLLATE utf8mb4_unicode_ci NOT NULL,
  `start_time` datetime(6) NOT NULL,
  `end_time` datetime(6) NOT NULL,
  `total_price` decimal(8,2) NOT NULL,
  `total_duration` int UNSIGNED NOT NULL,
  `notes` longtext COLLATE utf8mb4_unicode_ci,
  `internal_note` longtext COLLATE utf8mb4_unicode_ci,
  `deposit_paid` tinyint(1) NOT NULL,
  `stripe_payment_intent_id` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `reminder_sent_at` datetime(6) DEFAULT NULL,
  `created_at` datetime(6) NOT NULL,
  `updated_at` datetime(6) NOT NULL,
  `client_id` char(32) COLLATE utf8mb4_unicode_ci NOT NULL,
  `staff_id` char(32) COLLATE utf8mb4_unicode_ci DEFAULT NULL
) ;

-- --------------------------------------------------------

--
-- Structure de la table `appointment_services`
--

CREATE TABLE `appointment_services` (
  `id` char(32) COLLATE utf8mb4_unicode_ci NOT NULL,
  `price_snapshot` decimal(8,2) NOT NULL,
  `duration_snapshot` int UNSIGNED NOT NULL,
  `appointment_id` char(32) COLLATE utf8mb4_unicode_ci NOT NULL,
  `service_id` char(32) COLLATE utf8mb4_unicode_ci NOT NULL
) ;

-- --------------------------------------------------------

--
-- Structure de la table `auth_group`
--

CREATE TABLE `auth_group` (
  `id` int NOT NULL,
  `name` varchar(150) COLLATE utf8mb4_unicode_ci NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Structure de la table `auth_group_permissions`
--

CREATE TABLE `auth_group_permissions` (
  `id` bigint NOT NULL,
  `group_id` int NOT NULL,
  `permission_id` int NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Structure de la table `auth_permission`
--

CREATE TABLE `auth_permission` (
  `id` int NOT NULL,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `content_type_id` int NOT NULL,
  `codename` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Déchargement des données de la table `auth_permission`
--

INSERT INTO `auth_permission` (`id`, `name`, `content_type_id`, `codename`) VALUES
(1, 'Can add log entry', 1, 'add_logentry'),
(2, 'Can change log entry', 1, 'change_logentry'),
(3, 'Can delete log entry', 1, 'delete_logentry'),
(4, 'Can view log entry', 1, 'view_logentry'),
(5, 'Can add permission', 2, 'add_permission'),
(6, 'Can change permission', 2, 'change_permission'),
(7, 'Can delete permission', 2, 'delete_permission'),
(8, 'Can view permission', 2, 'view_permission'),
(9, 'Can add group', 3, 'add_group'),
(10, 'Can change group', 3, 'change_group'),
(11, 'Can delete group', 3, 'delete_group'),
(12, 'Can view group', 3, 'view_group'),
(13, 'Can add content type', 4, 'add_contenttype'),
(14, 'Can change content type', 4, 'change_contenttype'),
(15, 'Can delete content type', 4, 'delete_contenttype'),
(16, 'Can view content type', 4, 'view_contenttype'),
(17, 'Can add session', 5, 'add_session'),
(18, 'Can change session', 5, 'change_session'),
(19, 'Can delete session', 5, 'delete_session'),
(20, 'Can view session', 5, 'view_session'),
(21, 'Can add blacklisted token', 6, 'add_blacklistedtoken'),
(22, 'Can change blacklisted token', 6, 'change_blacklistedtoken'),
(23, 'Can delete blacklisted token', 6, 'delete_blacklistedtoken'),
(24, 'Can view blacklisted token', 6, 'view_blacklistedtoken'),
(25, 'Can add outstanding token', 7, 'add_outstandingtoken'),
(26, 'Can change outstanding token', 7, 'change_outstandingtoken'),
(27, 'Can delete outstanding token', 7, 'delete_outstandingtoken'),
(28, 'Can view outstanding token', 7, 'view_outstandingtoken'),
(29, 'Can add crontab', 8, 'add_crontabschedule'),
(30, 'Can change crontab', 8, 'change_crontabschedule'),
(31, 'Can delete crontab', 8, 'delete_crontabschedule'),
(32, 'Can view crontab', 8, 'view_crontabschedule'),
(33, 'Can add interval', 9, 'add_intervalschedule'),
(34, 'Can change interval', 9, 'change_intervalschedule'),
(35, 'Can delete interval', 9, 'delete_intervalschedule'),
(36, 'Can view interval', 9, 'view_intervalschedule'),
(37, 'Can add periodic task', 10, 'add_periodictask'),
(38, 'Can change periodic task', 10, 'change_periodictask'),
(39, 'Can delete periodic task', 10, 'delete_periodictask'),
(40, 'Can view periodic task', 10, 'view_periodictask'),
(41, 'Can add periodic tasks', 11, 'add_periodictasks'),
(42, 'Can change periodic tasks', 11, 'change_periodictasks'),
(43, 'Can delete periodic tasks', 11, 'delete_periodictasks'),
(44, 'Can view periodic tasks', 11, 'view_periodictasks'),
(45, 'Can add solar event', 12, 'add_solarschedule'),
(46, 'Can change solar event', 12, 'change_solarschedule'),
(47, 'Can delete solar event', 12, 'delete_solarschedule'),
(48, 'Can view solar event', 12, 'view_solarschedule'),
(49, 'Can add clocked', 13, 'add_clockedschedule'),
(50, 'Can change clocked', 13, 'change_clockedschedule'),
(51, 'Can delete clocked', 13, 'delete_clockedschedule'),
(52, 'Can view clocked', 13, 'view_clockedschedule'),
(53, 'Can add user', 14, 'add_user'),
(54, 'Can change user', 14, 'change_user'),
(55, 'Can delete user', 14, 'delete_user'),
(56, 'Can view user', 14, 'view_user'),
(57, 'Can add password reset token', 15, 'add_passwordresettoken'),
(58, 'Can change password reset token', 15, 'change_passwordresettoken'),
(59, 'Can delete password reset token', 15, 'delete_passwordresettoken'),
(60, 'Can view password reset token', 15, 'view_passwordresettoken'),
(61, 'Can add service', 16, 'add_service'),
(62, 'Can change service', 16, 'change_service'),
(63, 'Can delete service', 16, 'delete_service'),
(64, 'Can view service', 16, 'view_service'),
(65, 'Can add staff', 17, 'add_staff'),
(66, 'Can change staff', 17, 'change_staff'),
(67, 'Can delete staff', 17, 'delete_staff'),
(68, 'Can view staff', 17, 'view_staff'),
(69, 'Can add staff day off', 18, 'add_staffdayoff'),
(70, 'Can change staff day off', 18, 'change_staffdayoff'),
(71, 'Can delete staff day off', 18, 'delete_staffdayoff'),
(72, 'Can view staff day off', 18, 'view_staffdayoff'),
(73, 'Can add staff schedule', 19, 'add_staffschedule'),
(74, 'Can change staff schedule', 19, 'change_staffschedule'),
(75, 'Can delete staff schedule', 19, 'delete_staffschedule'),
(76, 'Can view staff schedule', 19, 'view_staffschedule'),
(77, 'Can add appointment', 20, 'add_appointment'),
(78, 'Can change appointment', 20, 'change_appointment'),
(79, 'Can delete appointment', 20, 'delete_appointment'),
(80, 'Can view appointment', 20, 'view_appointment'),
(81, 'Can add appointment service', 21, 'add_appointmentservice'),
(82, 'Can change appointment service', 21, 'change_appointmentservice'),
(83, 'Can delete appointment service', 21, 'delete_appointmentservice'),
(84, 'Can view appointment service', 21, 'view_appointmentservice'),
(85, 'Can add review', 22, 'add_review'),
(86, 'Can change review', 22, 'change_review'),
(87, 'Can delete review', 22, 'delete_review'),
(88, 'Can view review', 22, 'view_review');

-- --------------------------------------------------------

--
-- Structure de la table `django_admin_log`
--

CREATE TABLE `django_admin_log` (
  `id` int NOT NULL,
  `action_time` datetime(6) NOT NULL,
  `object_id` longtext COLLATE utf8mb4_unicode_ci,
  `object_repr` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL,
  `action_flag` smallint UNSIGNED NOT NULL,
  `change_message` longtext COLLATE utf8mb4_unicode_ci NOT NULL,
  `content_type_id` int DEFAULT NULL,
  `user_id` char(32) COLLATE utf8mb4_unicode_ci NOT NULL
) ;

-- --------------------------------------------------------

--
-- Structure de la table `django_celery_beat_clockedschedule`
--

CREATE TABLE `django_celery_beat_clockedschedule` (
  `id` int NOT NULL,
  `clocked_time` datetime(6) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Structure de la table `django_celery_beat_crontabschedule`
--

CREATE TABLE `django_celery_beat_crontabschedule` (
  `id` int NOT NULL,
  `minute` varchar(240) COLLATE utf8mb4_unicode_ci NOT NULL,
  `hour` varchar(96) COLLATE utf8mb4_unicode_ci NOT NULL,
  `day_of_week` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `day_of_month` varchar(124) COLLATE utf8mb4_unicode_ci NOT NULL,
  `month_of_year` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `timezone` varchar(63) COLLATE utf8mb4_unicode_ci NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Structure de la table `django_celery_beat_intervalschedule`
--

CREATE TABLE `django_celery_beat_intervalschedule` (
  `id` int NOT NULL,
  `every` int NOT NULL,
  `period` varchar(24) COLLATE utf8mb4_unicode_ci NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Structure de la table `django_celery_beat_periodictask`
--

CREATE TABLE `django_celery_beat_periodictask` (
  `id` int NOT NULL,
  `name` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL,
  `task` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL,
  `args` longtext COLLATE utf8mb4_unicode_ci NOT NULL,
  `kwargs` longtext COLLATE utf8mb4_unicode_ci NOT NULL,
  `queue` varchar(200) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `exchange` varchar(200) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `routing_key` varchar(200) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `expires` datetime(6) DEFAULT NULL,
  `enabled` tinyint(1) NOT NULL,
  `last_run_at` datetime(6) DEFAULT NULL,
  `total_run_count` int UNSIGNED NOT NULL,
  `date_changed` datetime(6) NOT NULL,
  `description` longtext COLLATE utf8mb4_unicode_ci NOT NULL,
  `crontab_id` int DEFAULT NULL,
  `interval_id` int DEFAULT NULL,
  `solar_id` int DEFAULT NULL,
  `one_off` tinyint(1) NOT NULL,
  `start_time` datetime(6) DEFAULT NULL,
  `priority` int UNSIGNED DEFAULT NULL,
  `headers` longtext COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT (_utf8mb3'{}'),
  `clocked_id` int DEFAULT NULL,
  `expire_seconds` int UNSIGNED DEFAULT NULL
) ;

-- --------------------------------------------------------

--
-- Structure de la table `django_celery_beat_periodictasks`
--

CREATE TABLE `django_celery_beat_periodictasks` (
  `ident` smallint NOT NULL,
  `last_update` datetime(6) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Structure de la table `django_celery_beat_solarschedule`
--

CREATE TABLE `django_celery_beat_solarschedule` (
  `id` int NOT NULL,
  `event` varchar(24) COLLATE utf8mb4_unicode_ci NOT NULL,
  `latitude` decimal(9,6) NOT NULL,
  `longitude` decimal(9,6) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Structure de la table `django_content_type`
--

CREATE TABLE `django_content_type` (
  `id` int NOT NULL,
  `app_label` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `model` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Déchargement des données de la table `django_content_type`
--

INSERT INTO `django_content_type` (`id`, `app_label`, `model`) VALUES
(1, 'admin', 'logentry'),
(20, 'appointments', 'appointment'),
(21, 'appointments', 'appointmentservice'),
(3, 'auth', 'group'),
(2, 'auth', 'permission'),
(4, 'contenttypes', 'contenttype'),
(13, 'django_celery_beat', 'clockedschedule'),
(8, 'django_celery_beat', 'crontabschedule'),
(9, 'django_celery_beat', 'intervalschedule'),
(10, 'django_celery_beat', 'periodictask'),
(11, 'django_celery_beat', 'periodictasks'),
(12, 'django_celery_beat', 'solarschedule'),
(22, 'reviews', 'review'),
(16, 'services', 'service'),
(5, 'sessions', 'session'),
(17, 'staff', 'staff'),
(18, 'staff', 'staffdayoff'),
(19, 'staff', 'staffschedule'),
(6, 'token_blacklist', 'blacklistedtoken'),
(7, 'token_blacklist', 'outstandingtoken'),
(15, 'users', 'passwordresettoken'),
(14, 'users', 'user');

-- --------------------------------------------------------

--
-- Structure de la table `django_migrations`
--

CREATE TABLE `django_migrations` (
  `id` bigint NOT NULL,
  `app` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `applied` datetime(6) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Déchargement des données de la table `django_migrations`
--

INSERT INTO `django_migrations` (`id`, `app`, `name`, `applied`) VALUES
(1, 'contenttypes', '0001_initial', '2026-05-22 19:34:14.714609'),
(2, 'contenttypes', '0002_remove_content_type_name', '2026-05-22 19:34:14.800733'),
(3, 'auth', '0001_initial', '2026-05-22 19:34:15.085805'),
(4, 'auth', '0002_alter_permission_name_max_length', '2026-05-22 19:34:15.163297'),
(5, 'auth', '0003_alter_user_email_max_length', '2026-05-22 19:34:15.179892'),
(6, 'auth', '0004_alter_user_username_opts', '2026-05-22 19:34:15.192969'),
(7, 'auth', '0005_alter_user_last_login_null', '2026-05-22 19:34:15.204119'),
(8, 'auth', '0006_require_contenttypes_0002', '2026-05-22 19:34:15.206126'),
(9, 'auth', '0007_alter_validators_add_error_messages', '2026-05-22 19:34:15.216709'),
(10, 'auth', '0008_alter_user_username_max_length', '2026-05-22 19:34:15.227933'),
(11, 'auth', '0009_alter_user_last_name_max_length', '2026-05-22 19:34:15.239772'),
(12, 'auth', '0010_alter_group_name_max_length', '2026-05-22 19:34:15.261017'),
(13, 'auth', '0011_update_proxy_permissions', '2026-05-22 19:34:15.277340'),
(14, 'auth', '0012_alter_user_first_name_max_length', '2026-05-22 19:34:15.291838'),
(15, 'users', '0001_initial', '2026-05-22 19:34:15.666337'),
(16, 'admin', '0001_initial', '2026-05-22 19:34:15.794682'),
(17, 'admin', '0002_logentry_remove_auto_add', '2026-05-22 19:34:15.818527'),
(18, 'admin', '0003_logentry_add_action_flag_choices', '2026-05-22 19:34:15.839367'),
(19, 'services', '0001_initial', '2026-05-22 19:34:15.869062'),
(20, 'staff', '0001_initial', '2026-05-22 19:34:16.170961'),
(21, 'appointments', '0001_initial', '2026-05-22 19:34:16.290725'),
(22, 'appointments', '0002_initial', '2026-05-22 19:34:16.675546'),
(23, 'django_celery_beat', '0001_initial', '2026-05-22 19:34:16.896744'),
(24, 'django_celery_beat', '0002_auto_20161118_0346', '2026-05-22 19:34:17.055850'),
(25, 'django_celery_beat', '0003_auto_20161209_0049', '2026-05-22 19:34:17.117092'),
(26, 'django_celery_beat', '0004_auto_20170221_0000', '2026-05-22 19:34:17.127037'),
(27, 'django_celery_beat', '0005_add_solarschedule_events_choices', '2026-05-22 19:34:17.137351'),
(28, 'django_celery_beat', '0006_auto_20180322_0932', '2026-05-22 19:34:17.391503'),
(29, 'django_celery_beat', '0007_auto_20180521_0826', '2026-05-22 19:34:17.635255'),
(30, 'django_celery_beat', '0008_auto_20180914_1922', '2026-05-22 19:34:17.748632'),
(31, 'django_celery_beat', '0006_auto_20180210_1226', '2026-05-22 19:34:17.831532'),
(32, 'django_celery_beat', '0006_periodictask_priority', '2026-05-22 19:34:17.940954'),
(33, 'django_celery_beat', '0009_periodictask_headers', '2026-05-22 19:34:18.036001'),
(34, 'django_celery_beat', '0010_auto_20190429_0326', '2026-05-22 19:34:18.927451'),
(35, 'django_celery_beat', '0011_auto_20190508_0153', '2026-05-22 19:34:19.039275'),
(36, 'django_celery_beat', '0012_periodictask_expire_seconds', '2026-05-22 19:34:19.129468'),
(37, 'django_celery_beat', '0013_auto_20200609_0727', '2026-05-22 19:34:19.170141'),
(38, 'django_celery_beat', '0014_remove_clockedschedule_enabled', '2026-05-22 19:34:19.227730'),
(39, 'django_celery_beat', '0015_edit_solarschedule_events_choices', '2026-05-22 19:34:19.241287'),
(40, 'django_celery_beat', '0016_alter_crontabschedule_timezone', '2026-05-22 19:34:19.275262'),
(41, 'django_celery_beat', '0017_alter_crontabschedule_month_of_year', '2026-05-22 19:34:19.311152'),
(42, 'django_celery_beat', '0018_improve_crontab_helptext', '2026-05-22 19:34:19.336048'),
(43, 'reviews', '0001_initial', '2026-05-22 19:34:19.534501'),
(44, 'reviews', '0002_initial', '2026-05-22 19:34:19.627328'),
(45, 'sessions', '0001_initial', '2026-05-22 19:34:19.675330'),
(46, 'token_blacklist', '0001_initial', '2026-05-22 19:34:19.864010'),
(47, 'token_blacklist', '0002_outstandingtoken_jti_hex', '2026-05-22 19:34:19.959508'),
(48, 'token_blacklist', '0003_auto_20171017_2007', '2026-05-22 19:34:20.030548'),
(49, 'token_blacklist', '0004_auto_20171017_2013', '2026-05-22 19:34:20.183203'),
(50, 'token_blacklist', '0005_remove_outstandingtoken_jti', '2026-05-22 19:34:20.270175'),
(51, 'token_blacklist', '0006_auto_20171017_2113', '2026-05-22 19:34:20.474171'),
(52, 'token_blacklist', '0007_auto_20171017_2214', '2026-05-22 19:34:20.788604'),
(53, 'token_blacklist', '0008_migrate_to_bigautofield', '2026-05-22 19:34:21.022945'),
(54, 'token_blacklist', '0010_fix_migrate_to_bigautofield', '2026-05-22 19:34:21.082281'),
(55, 'token_blacklist', '0011_linearizes_history', '2026-05-22 19:34:21.084825'),
(56, 'token_blacklist', '0012_alter_outstandingtoken_user', '2026-05-22 19:34:21.128589');

-- --------------------------------------------------------

--
-- Structure de la table `django_session`
--

CREATE TABLE `django_session` (
  `session_key` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL,
  `session_data` longtext COLLATE utf8mb4_unicode_ci NOT NULL,
  `expire_date` datetime(6) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Structure de la table `password_reset_tokens`
--

CREATE TABLE `password_reset_tokens` (
  `id` char(32) COLLATE utf8mb4_unicode_ci NOT NULL,
  `token` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `expires_at` datetime(6) NOT NULL,
  `used_at` datetime(6) DEFAULT NULL,
  `created_at` datetime(6) NOT NULL,
  `user_id` char(32) COLLATE utf8mb4_unicode_ci NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Structure de la table `reviews`
--

CREATE TABLE `reviews` (
  `id` char(32) COLLATE utf8mb4_unicode_ci NOT NULL,
  `rating` smallint UNSIGNED NOT NULL,
  `comment` longtext COLLATE utf8mb4_unicode_ci,
  `is_published` tinyint(1) NOT NULL,
  `admin_reply` longtext COLLATE utf8mb4_unicode_ci,
  `created_at` datetime(6) NOT NULL,
  `updated_at` datetime(6) NOT NULL,
  `appointment_id` char(32) COLLATE utf8mb4_unicode_ci NOT NULL,
  `client_id` char(32) COLLATE utf8mb4_unicode_ci DEFAULT NULL
) ;

-- --------------------------------------------------------

--
-- Structure de la table `services`
--

CREATE TABLE `services` (
  `id` char(32) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(120) COLLATE utf8mb4_unicode_ci NOT NULL,
  `slug` varchar(140) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` longtext COLLATE utf8mb4_unicode_ci,
  `category` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `price` decimal(8,2) NOT NULL,
  `duration` int UNSIGNED NOT NULL,
  `image_url` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL,
  `is_popular` tinyint(1) NOT NULL,
  `display_order` int UNSIGNED NOT NULL,
  `created_at` datetime(6) NOT NULL,
  `updated_at` datetime(6) NOT NULL
) ;

-- --------------------------------------------------------

--
-- Structure de la table `staff`
--

CREATE TABLE `staff` (
  `id` char(32) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `slug` varchar(120) COLLATE utf8mb4_unicode_ci NOT NULL,
  `role` varchar(80) COLLATE utf8mb4_unicode_ci NOT NULL,
  `bio` longtext COLLATE utf8mb4_unicode_ci,
  `avatar` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL,
  `display_order` int UNSIGNED NOT NULL,
  `created_at` datetime(6) NOT NULL,
  `updated_at` datetime(6) NOT NULL
) ;

-- --------------------------------------------------------

--
-- Structure de la table `staff_days_off`
--

CREATE TABLE `staff_days_off` (
  `id` char(32) COLLATE utf8mb4_unicode_ci NOT NULL,
  `date` date NOT NULL,
  `reason` varchar(200) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` datetime(6) NOT NULL,
  `staff_id` char(32) COLLATE utf8mb4_unicode_ci NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Structure de la table `staff_schedules`
--

CREATE TABLE `staff_schedules` (
  `id` char(32) COLLATE utf8mb4_unicode_ci NOT NULL,
  `day_of_week` int NOT NULL,
  `start_time` time(6) NOT NULL,
  `end_time` time(6) NOT NULL,
  `is_working` tinyint(1) NOT NULL,
  `staff_id` char(32) COLLATE utf8mb4_unicode_ci NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Structure de la table `staff_services`
--

CREATE TABLE `staff_services` (
  `id` bigint NOT NULL,
  `staff_id` char(32) COLLATE utf8mb4_unicode_ci NOT NULL,
  `service_id` char(32) COLLATE utf8mb4_unicode_ci NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Structure de la table `token_blacklist_blacklistedtoken`
--

CREATE TABLE `token_blacklist_blacklistedtoken` (
  `id` bigint NOT NULL,
  `blacklisted_at` datetime(6) NOT NULL,
  `token_id` bigint NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Structure de la table `token_blacklist_outstandingtoken`
--

CREATE TABLE `token_blacklist_outstandingtoken` (
  `id` bigint NOT NULL,
  `token` longtext COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_at` datetime(6) DEFAULT NULL,
  `expires_at` datetime(6) NOT NULL,
  `user_id` char(32) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `jti` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Structure de la table `users`
--

CREATE TABLE `users` (
  `password` varchar(128) COLLATE utf8mb4_unicode_ci NOT NULL,
  `last_login` datetime(6) DEFAULT NULL,
  `is_superuser` tinyint(1) NOT NULL,
  `id` char(32) COLLATE utf8mb4_unicode_ci NOT NULL,
  `email` varchar(254) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(120) COLLATE utf8mb4_unicode_ci NOT NULL,
  `phone` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `role` varchar(10) COLLATE utf8mb4_unicode_ci NOT NULL,
  `avatar_url` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `email_verified` tinyint(1) NOT NULL,
  `is_active` tinyint(1) NOT NULL,
  `is_staff` tinyint(1) NOT NULL,
  `created_at` datetime(6) NOT NULL,
  `updated_at` datetime(6) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Structure de la table `users_groups`
--

CREATE TABLE `users_groups` (
  `id` bigint NOT NULL,
  `user_id` char(32) COLLATE utf8mb4_unicode_ci NOT NULL,
  `group_id` int NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Structure de la table `users_user_permissions`
--

CREATE TABLE `users_user_permissions` (
  `id` bigint NOT NULL,
  `user_id` char(32) COLLATE utf8mb4_unicode_ci NOT NULL,
  `permission_id` int NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Index pour les tables déchargées
--

--
-- Index pour la table `appointments`
--
ALTER TABLE `appointments`
  ADD PRIMARY KEY (`id`),
  ADD KEY `appointments_status_ff89895a` (`status`),
  ADD KEY `appointments_start_time_89f0add5` (`start_time`),
  ADD KEY `appointments_client_id_ed088e20_fk_users_id` (`client_id`),
  ADD KEY `appointments_staff_id_7c079f40_fk_staff_id` (`staff_id`);

--
-- Index pour la table `appointment_services`
--
ALTER TABLE `appointment_services`
  ADD PRIMARY KEY (`id`),
  ADD KEY `appointment_services_appointment_id_40b96890_fk_appointments_id` (`appointment_id`),
  ADD KEY `appointment_services_service_id_cf930aa0_fk_services_id` (`service_id`);

--
-- Index pour la table `auth_group`
--
ALTER TABLE `auth_group`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `name` (`name`);

--
-- Index pour la table `auth_group_permissions`
--
ALTER TABLE `auth_group_permissions`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `auth_group_permissions_group_id_permission_id_0cd325b0_uniq` (`group_id`,`permission_id`),
  ADD KEY `auth_group_permissio_permission_id_84c5c92e_fk_auth_perm` (`permission_id`);

--
-- Index pour la table `auth_permission`
--
ALTER TABLE `auth_permission`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `auth_permission_content_type_id_codename_01ab375a_uniq` (`content_type_id`,`codename`);

--
-- Index pour la table `django_admin_log`
--
ALTER TABLE `django_admin_log`
  ADD PRIMARY KEY (`id`),
  ADD KEY `django_admin_log_content_type_id_c4bce8eb_fk_django_co` (`content_type_id`),
  ADD KEY `django_admin_log_user_id_c564eba6_fk_users_id` (`user_id`);

--
-- Index pour la table `django_celery_beat_clockedschedule`
--
ALTER TABLE `django_celery_beat_clockedschedule`
  ADD PRIMARY KEY (`id`);

--
-- Index pour la table `django_celery_beat_crontabschedule`
--
ALTER TABLE `django_celery_beat_crontabschedule`
  ADD PRIMARY KEY (`id`);

--
-- Index pour la table `django_celery_beat_intervalschedule`
--
ALTER TABLE `django_celery_beat_intervalschedule`
  ADD PRIMARY KEY (`id`);

--
-- Index pour la table `django_celery_beat_periodictask`
--
ALTER TABLE `django_celery_beat_periodictask`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `name` (`name`),
  ADD KEY `django_celery_beat_p_crontab_id_d3cba168_fk_django_ce` (`crontab_id`),
  ADD KEY `django_celery_beat_p_interval_id_a8ca27da_fk_django_ce` (`interval_id`),
  ADD KEY `django_celery_beat_p_solar_id_a87ce72c_fk_django_ce` (`solar_id`),
  ADD KEY `django_celery_beat_p_clocked_id_47a69f82_fk_django_ce` (`clocked_id`);

--
-- Index pour la table `django_celery_beat_periodictasks`
--
ALTER TABLE `django_celery_beat_periodictasks`
  ADD PRIMARY KEY (`ident`);

--
-- Index pour la table `django_celery_beat_solarschedule`
--
ALTER TABLE `django_celery_beat_solarschedule`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `django_celery_beat_solar_event_latitude_longitude_ba64999a_uniq` (`event`,`latitude`,`longitude`);

--
-- Index pour la table `django_content_type`
--
ALTER TABLE `django_content_type`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `django_content_type_app_label_model_76bd3d3b_uniq` (`app_label`,`model`);

--
-- Index pour la table `django_migrations`
--
ALTER TABLE `django_migrations`
  ADD PRIMARY KEY (`id`);

--
-- Index pour la table `django_session`
--
ALTER TABLE `django_session`
  ADD PRIMARY KEY (`session_key`),
  ADD KEY `django_session_expire_date_a5c62663` (`expire_date`);

--
-- Index pour la table `password_reset_tokens`
--
ALTER TABLE `password_reset_tokens`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `token` (`token`),
  ADD KEY `password_reset_tokens_user_id_0aeaaad3_fk_users_id` (`user_id`);

--
-- Index pour la table `reviews`
--
ALTER TABLE `reviews`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `appointment_id` (`appointment_id`),
  ADD KEY `reviews_is_published_38d438c0` (`is_published`),
  ADD KEY `reviews_client_id_6232284c_fk_users_id` (`client_id`);

--
-- Index pour la table `services`
--
ALTER TABLE `services`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `slug` (`slug`);

--
-- Index pour la table `staff`
--
ALTER TABLE `staff`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `slug` (`slug`);

--
-- Index pour la table `staff_days_off`
--
ALTER TABLE `staff_days_off`
  ADD PRIMARY KEY (`id`),
  ADD KEY `staff_days_off_staff_id_0e831bc1_fk_staff_id` (`staff_id`),
  ADD KEY `staff_days_off_date_ba5b49c9` (`date`);

--
-- Index pour la table `staff_schedules`
--
ALTER TABLE `staff_schedules`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `staff_schedules_staff_id_day_of_week_52fa3cc2_uniq` (`staff_id`,`day_of_week`);

--
-- Index pour la table `staff_services`
--
ALTER TABLE `staff_services`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `staff_services_staff_id_service_id_502af112_uniq` (`staff_id`,`service_id`),
  ADD KEY `staff_services_service_id_1e72b460_fk_services_id` (`service_id`);

--
-- Index pour la table `token_blacklist_blacklistedtoken`
--
ALTER TABLE `token_blacklist_blacklistedtoken`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `token_id` (`token_id`);

--
-- Index pour la table `token_blacklist_outstandingtoken`
--
ALTER TABLE `token_blacklist_outstandingtoken`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `token_blacklist_outstandingtoken_jti_hex_d9bdf6f7_uniq` (`jti`),
  ADD KEY `token_blacklist_outstandingtoken_user_id_83bc629a_fk_users_id` (`user_id`);

--
-- Index pour la table `users`
--
ALTER TABLE `users`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `email` (`email`);

--
-- Index pour la table `users_groups`
--
ALTER TABLE `users_groups`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `users_groups_user_id_group_id_fc7788e8_uniq` (`user_id`,`group_id`),
  ADD KEY `users_groups_group_id_2f3517aa_fk_auth_group_id` (`group_id`);

--
-- Index pour la table `users_user_permissions`
--
ALTER TABLE `users_user_permissions`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `users_user_permissions_user_id_permission_id_3b86cbdf_uniq` (`user_id`,`permission_id`),
  ADD KEY `users_user_permissio_permission_id_6d08dcd2_fk_auth_perm` (`permission_id`);

--
-- AUTO_INCREMENT pour les tables déchargées
--

--
-- AUTO_INCREMENT pour la table `auth_group`
--
ALTER TABLE `auth_group`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT pour la table `auth_group_permissions`
--
ALTER TABLE `auth_group_permissions`
  MODIFY `id` bigint NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT pour la table `auth_permission`
--
ALTER TABLE `auth_permission`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=89;

--
-- AUTO_INCREMENT pour la table `django_admin_log`
--
ALTER TABLE `django_admin_log`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT pour la table `django_celery_beat_clockedschedule`
--
ALTER TABLE `django_celery_beat_clockedschedule`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT pour la table `django_celery_beat_crontabschedule`
--
ALTER TABLE `django_celery_beat_crontabschedule`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT pour la table `django_celery_beat_intervalschedule`
--
ALTER TABLE `django_celery_beat_intervalschedule`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT pour la table `django_celery_beat_periodictask`
--
ALTER TABLE `django_celery_beat_periodictask`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT pour la table `django_celery_beat_solarschedule`
--
ALTER TABLE `django_celery_beat_solarschedule`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT pour la table `django_content_type`
--
ALTER TABLE `django_content_type`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=23;

--
-- AUTO_INCREMENT pour la table `django_migrations`
--
ALTER TABLE `django_migrations`
  MODIFY `id` bigint NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=57;

--
-- AUTO_INCREMENT pour la table `staff_services`
--
ALTER TABLE `staff_services`
  MODIFY `id` bigint NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT pour la table `token_blacklist_blacklistedtoken`
--
ALTER TABLE `token_blacklist_blacklistedtoken`
  MODIFY `id` bigint NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT pour la table `token_blacklist_outstandingtoken`
--
ALTER TABLE `token_blacklist_outstandingtoken`
  MODIFY `id` bigint NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT pour la table `users_groups`
--
ALTER TABLE `users_groups`
  MODIFY `id` bigint NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT pour la table `users_user_permissions`
--
ALTER TABLE `users_user_permissions`
  MODIFY `id` bigint NOT NULL AUTO_INCREMENT;

--
-- Contraintes pour les tables déchargées
--

--
-- Contraintes pour la table `appointments`
--
ALTER TABLE `appointments`
  ADD CONSTRAINT `appointments_client_id_ed088e20_fk_users_id` FOREIGN KEY (`client_id`) REFERENCES `users` (`id`),
  ADD CONSTRAINT `appointments_staff_id_7c079f40_fk_staff_id` FOREIGN KEY (`staff_id`) REFERENCES `staff` (`id`);

--
-- Contraintes pour la table `appointment_services`
--
ALTER TABLE `appointment_services`
  ADD CONSTRAINT `appointment_services_appointment_id_40b96890_fk_appointments_id` FOREIGN KEY (`appointment_id`) REFERENCES `appointments` (`id`),
  ADD CONSTRAINT `appointment_services_service_id_cf930aa0_fk_services_id` FOREIGN KEY (`service_id`) REFERENCES `services` (`id`);

--
-- Contraintes pour la table `auth_group_permissions`
--
ALTER TABLE `auth_group_permissions`
  ADD CONSTRAINT `auth_group_permissio_permission_id_84c5c92e_fk_auth_perm` FOREIGN KEY (`permission_id`) REFERENCES `auth_permission` (`id`),
  ADD CONSTRAINT `auth_group_permissions_group_id_b120cbf9_fk_auth_group_id` FOREIGN KEY (`group_id`) REFERENCES `auth_group` (`id`);

--
-- Contraintes pour la table `auth_permission`
--
ALTER TABLE `auth_permission`
  ADD CONSTRAINT `auth_permission_content_type_id_2f476e4b_fk_django_co` FOREIGN KEY (`content_type_id`) REFERENCES `django_content_type` (`id`);

--
-- Contraintes pour la table `django_admin_log`
--
ALTER TABLE `django_admin_log`
  ADD CONSTRAINT `django_admin_log_content_type_id_c4bce8eb_fk_django_co` FOREIGN KEY (`content_type_id`) REFERENCES `django_content_type` (`id`),
  ADD CONSTRAINT `django_admin_log_user_id_c564eba6_fk_users_id` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`);

--
-- Contraintes pour la table `django_celery_beat_periodictask`
--
ALTER TABLE `django_celery_beat_periodictask`
  ADD CONSTRAINT `django_celery_beat_p_clocked_id_47a69f82_fk_django_ce` FOREIGN KEY (`clocked_id`) REFERENCES `django_celery_beat_clockedschedule` (`id`),
  ADD CONSTRAINT `django_celery_beat_p_crontab_id_d3cba168_fk_django_ce` FOREIGN KEY (`crontab_id`) REFERENCES `django_celery_beat_crontabschedule` (`id`),
  ADD CONSTRAINT `django_celery_beat_p_interval_id_a8ca27da_fk_django_ce` FOREIGN KEY (`interval_id`) REFERENCES `django_celery_beat_intervalschedule` (`id`),
  ADD CONSTRAINT `django_celery_beat_p_solar_id_a87ce72c_fk_django_ce` FOREIGN KEY (`solar_id`) REFERENCES `django_celery_beat_solarschedule` (`id`);

--
-- Contraintes pour la table `password_reset_tokens`
--
ALTER TABLE `password_reset_tokens`
  ADD CONSTRAINT `password_reset_tokens_user_id_0aeaaad3_fk_users_id` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`);

--
-- Contraintes pour la table `reviews`
--
ALTER TABLE `reviews`
  ADD CONSTRAINT `reviews_appointment_id_9141b057_fk_appointments_id` FOREIGN KEY (`appointment_id`) REFERENCES `appointments` (`id`),
  ADD CONSTRAINT `reviews_client_id_6232284c_fk_users_id` FOREIGN KEY (`client_id`) REFERENCES `users` (`id`);

--
-- Contraintes pour la table `staff_days_off`
--
ALTER TABLE `staff_days_off`
  ADD CONSTRAINT `staff_days_off_staff_id_0e831bc1_fk_staff_id` FOREIGN KEY (`staff_id`) REFERENCES `staff` (`id`);

--
-- Contraintes pour la table `staff_schedules`
--
ALTER TABLE `staff_schedules`
  ADD CONSTRAINT `staff_schedules_staff_id_592f9d04_fk_staff_id` FOREIGN KEY (`staff_id`) REFERENCES `staff` (`id`);

--
-- Contraintes pour la table `staff_services`
--
ALTER TABLE `staff_services`
  ADD CONSTRAINT `staff_services_service_id_1e72b460_fk_services_id` FOREIGN KEY (`service_id`) REFERENCES `services` (`id`),
  ADD CONSTRAINT `staff_services_staff_id_7ec3e32b_fk_staff_id` FOREIGN KEY (`staff_id`) REFERENCES `staff` (`id`);

--
-- Contraintes pour la table `token_blacklist_blacklistedtoken`
--
ALTER TABLE `token_blacklist_blacklistedtoken`
  ADD CONSTRAINT `token_blacklist_blacklistedtoken_token_id_3cc7fe56_fk` FOREIGN KEY (`token_id`) REFERENCES `token_blacklist_outstandingtoken` (`id`);

--
-- Contraintes pour la table `token_blacklist_outstandingtoken`
--
ALTER TABLE `token_blacklist_outstandingtoken`
  ADD CONSTRAINT `token_blacklist_outstandingtoken_user_id_83bc629a_fk_users_id` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`);

--
-- Contraintes pour la table `users_groups`
--
ALTER TABLE `users_groups`
  ADD CONSTRAINT `users_groups_group_id_2f3517aa_fk_auth_group_id` FOREIGN KEY (`group_id`) REFERENCES `auth_group` (`id`),
  ADD CONSTRAINT `users_groups_user_id_f500bee5_fk_users_id` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`);

--
-- Contraintes pour la table `users_user_permissions`
--
ALTER TABLE `users_user_permissions`
  ADD CONSTRAINT `users_user_permissio_permission_id_6d08dcd2_fk_auth_perm` FOREIGN KEY (`permission_id`) REFERENCES `auth_permission` (`id`),
  ADD CONSTRAINT `users_user_permissions_user_id_92473840_fk_users_id` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`);
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
