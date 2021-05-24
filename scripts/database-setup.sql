DROP TABLE IF EXISTS `users`;

CREATE TABLE `users` (
  `id` INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
  `username` varchar(32) NOT NULL,
  `username_custom` varchar(32) NOT NULL,
  `email` varchar(128),
  `password` varchar(256) NOT NULL,
  `money` int NOT NULL,
  `xp` int NOT NULL,
  `right` int NOT NULL,
  `data` varchar(4096) NOT NULL,
  `storage` varchar(8192) DEFAULT '{}' NOT NULL,
  `tms_created` int NOT NULL,
  `tms_last_seen` int NOT NULL,
  CONSTRAINT username_unique UNIQUE(username)
);

DROP TABLE IF EXISTS `messages`;
CREATE TABLE `messages` (
  `id` INTEGER PRIMARY KEY NOT NULL,
  `room_id` INTEGER KEY NOT NULL,
  `user_id` INTEGER KEY NOT NULL,
  `quoted_message_id` INTEGER KEY DEFAULT NULL,
  `content` varchar(2048) NOT NULL,
  `date` datetime KEY NOT NULL DEFAULT '0000-00-00 00:00:00' DEFAULT CURRENT_TIMESTAMP,
  `ip` varchar(39) DEFAULT NULL
);
