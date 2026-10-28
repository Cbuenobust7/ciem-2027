<?php
/*
Plugin Name: Plugin WordPress: contacto por WhatsApp
Description: Shortcode configurable para mostrar un enlace de WhatsApp. Incluye número y texto mediante atributos.
Version: 1.0.0
Author: CIEM
License: MIT
*/
if (!defined("ABSPATH")) { exit; }
add_shortcode('ciem_whatsapp', function($atts) {
 $a = shortcode_atts(array('numero'=>'','texto'=>'Contactar por WhatsApp','mensaje'=>''), $atts, 'ciem_whatsapp');
 $number = preg_replace('/[^0-9]/', '', $a['numero']);
 if (!$number) return '';
 $url = 'https://wa.me/' . $number;
 if ($a['mensaje'] !== '') $url = add_query_arg('text', $a['mensaje'], $url);
 return '<a style="display:inline-block;background:#25d366;color:#083b20;padding:12px 18px;border-radius:8px;font-weight:700;text-decoration:none" target="_blank" rel="noopener noreferrer" href="'.esc_url($url).'">'.esc_html($a['texto']).'</a>';
});
