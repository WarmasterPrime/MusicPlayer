<?php
function parse($q=false){return preg_replace("/[^A-z0-9 \-\_\&\^\!\@\~\`\#\$\%\*\(\)\+=\{\[\}\]:;'\"\?\.\,<>\\\\\/\|]*/","",$q);}
?>