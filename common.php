<?php
# Shared by index.php and build_agnos.php
define("GITHUB_REPO", "CHaucke89/cloudypilot");  # owner/repo installed by every generated binary
define("DEFAULT_BRANCH", "master-prebuilt");
define("LOADING_MSG", "cloudypilot");  # shown as "Installing cloudypilot", max 39 chars

# The branch gets pasted into shell commands run by the installer, so only allow characters valid in git refs
function valid_branch($branch) {
    return strlen($branch) <= 255 && preg_match('/^[A-Za-z0-9._\/-]+$/', $branch) && !str_contains($branch, "..");
}
?>
