<?php
// 🔐 Define a named constant; the VALUE is your key string (in quotes)
if (!defined('AIzaSyCVd9-pxut_iL0YhJ9tpmMrJiHY8kyWAR8')) {
  define('AIzaSyCVd9-pxut_iL0YhJ9tpmMrJiHY8kyWAR8', 'AIzaSyCVd9-pxut_iL0YhJ9tpmMrJiHY8kyWAR8');
}

return [
  'db' => [
    'host'    => 'localhost',
    'name'    => 'u327153873_shs_club_db',
    'user'    => 'u327153873_shs_club',
    'pass'    => 'Hellomonsta123!',
    'charset' => 'utf8mb4',
  ],
  'session' => [
    'name'     => 'shs_club_sid',
    'httponly' => true,
    'samesite' => 'Lax',
  ],
];
