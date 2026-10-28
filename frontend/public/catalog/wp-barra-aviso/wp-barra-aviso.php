<?php
/*
Plugin Name: Plugin WordPress: aviso destacado
Description: Shortcode para publicar un aviso con texto y enlace opcional, sin dependencias externas.
Version: 1.0.0
Author: CIEM
License: MIT
*/
if (!defined("ABSPATH")) { exit; }
add_shortcode('ciem_aviso', function($atts) {
 $a = shortcode_atts(array('texto'=>'','url'=>'','enlace'=>'Más información'), $atts, 'ciem_aviso');
 if ($a['texto'] === '') return '';
 $link = $a['url'] !== '' ? ' <a style="color:#06d69a" href="'.esc_url($a['url']).'">'.esc_html($a['enlace']).'</a>' : '';
 return '<aside style="background:#101f65;color:white;padding:16px;border-radius:8px">'.esc_html($a['texto']).$link.'</aside>';
});
