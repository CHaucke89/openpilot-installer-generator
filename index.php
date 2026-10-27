<?php
error_reporting(E_ALL ^ E_WARNING);
require_once "common.php";

# Constants
define("USER_AGENT", $_SERVER['HTTP_USER_AGENT'] ?? "");
define("IS_AGNOS", str_contains(USER_AGENT, "AGNOSSetup"));
define("IS_WGET", str_contains(USER_AGENT, "Wget"));

define("WEBSITE_URL", "https://installer.hauckelabs.dev");
define("BASE_DIR", "");

function logData() {
    global $url;
    global $branch;
    date_default_timezone_set('America/New_York');

    $data = array("IP" => $_SERVER['REMOTE_ADDR'], "url" => $url, "branch" => $branch, "is_agnos" => IS_AGNOS, "is_wget" => IS_WGET, "user_agent" => USER_AGENT, "date" => date("Y-m-d_H:i:s",time()));
    $data = json_encode($data);

    $fp = fopen("log.txt", "a");
    fwrite($fp, $data."\n");
    fclose($fp);
}

$url = "";
if (array_key_exists("url", $_GET)) {
    $url = $_GET["url"];
}

# The whole path is the branch, so branches with slashes work (installer.hauckelabs.dev/feature/foo)
$branch = trim($url, "/ ");
$use_default = $branch == "";
if ($use_default) $branch = DEFAULT_BRANCH;

logData();

$build_url = BASE_DIR . "/build_agnos.php?" . http_build_query(["branch" => $branch]);
if (IS_AGNOS or IS_WGET) {  # device setup or wget: serve the binary immediately
    if (!valid_branch($branch)) { http_response_code(400); echo "Error: Invalid branch name!"; exit; }
    header("Location: " . $build_url);
    exit;
}

if(array_key_exists('download_agnos', $_POST) and valid_branch($branch)) {
    header("Location: " . $build_url);
    exit;
}

# Draws visual elements for website
echo '<head>
<link rel="preconnect" href="https://fonts.gstatic.com">
<link href="https://fonts.googleapis.com/css2?family=Roboto&display=swap" rel="stylesheet">
<style>
body {background-image: linear-gradient(#F9DEC9, #99B2DD); font-family: "Roboto", sans-serif; color: #30323D; text-align: center;}
span { color: #6369D1; }
a { text-decoration: none; color: #6369D1;}
button[name="download_agnos"] {background-color: #ace6df; border-radius: 4px; border: 5px; padding: 10px 12px; box-shadow:0px 4px 0px #80c2ba; display: inline-block; color: #30323D;top: 1px; outline: 0px transparent !important;}
button:active[name="download_agnos"] {border-radius: 4px; border: 5px; padding: 10px 12px; box-shadow:0px 2px 2px #89c7c7; background-color: #89c7c7; display: inline-block; top: 1px, outline: 0px transparent !important;}
</style>
<title>cloudypilot installer</title>
<link rel="icon" type="image/x-icon" href="' . BASE_DIR . '/public/favicon.ico">
</head>';

echo '</br></br><a href="' . BASE_DIR . '/"><h1 style="color: #30323D;">☁️ cloudypilot installer ☁️</h1></a>';
echo '<h3 style="position: absolute; bottom: 0; left: 0; width: 100%; text-align: center;"><a href="https://github.com/' . GITHUB_REPO . '" style="color: 30323D;">💾 cloudypilot GitHub Repo</a></h3>';

if (!valid_branch($branch)) {
    echo '<h3>❗ Invalid branch name ❗</h3>';
    exit;
}

$branch_html = htmlspecialchars($branch);
if ($use_default) {
    echo "</br><h2>Enter this URL on your device during setup with the format:</h2>";
    echo "<h2><span>" . WEBSITE_URL . BASE_DIR . "/branch</span></h2>";
    echo "<h3>Leaving the branch off installs <a href='https://github.com/" . GITHUB_REPO . "/tree/" . DEFAULT_BRANCH . "'>" . DEFAULT_BRANCH . "</a>.</h3>";
} else {
    echo '<h3>Given branch: <a href="https://github.com/' . GITHUB_REPO . '/tree/' . $branch_html . '">' . $branch_html . '</a></h3>';
}

echo '<html>
    <body>
        <form method="post">
        <button class="button" name="download_agnos">Download Installer Binary</button>
    </form>
    <h5>Or enter this URL on the setup screen on your device.</h5>
    </body>
</html>';
?>
