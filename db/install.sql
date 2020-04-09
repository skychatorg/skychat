DROP TABLE IF EXISTS `users`;

CREATE TABLE `users` (
  `id` INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
  `username` varchar(32) NOT NULL,
  `username_custom` varchar(32) NOT NULL,
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
