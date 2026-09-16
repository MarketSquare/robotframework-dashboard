"""Behaviour profiles for the generated fixtures.

Everything that makes the fixture data "interesting" for the dashboard is
declared here: which tests fail, when, how often, how slow they are, and what
the failure/exception messages look like. Tests not listed are stable passes.

Profile syntax (value of PROFILES):
  stable                  always passes (default)
  always-fail             fails in every run                 -> Most Failed
  flaky:<rate>            fails with probability <rate>      -> Most Flaky
  broken-since:<run>      passes before run <run>, fails after -> Recent Most Failed
  fixed-since:<run>       fails before run <run>, passes after
  slow-outlier:<rate>     3-6x slower with probability <rate> -> Duration Deviation
  slower-every-run:<step> duration factor 1 + step*run_index -> Duration trend
  faster-every-run:<step> duration factor 2.5 - step*run_index
"""

PROFILES = {
    # ---------------------------------------------------------------- WebshopUI
    "Product Page Share Buttons": "always-fail",
    "Cart Quantity Limit Per Product": "always-fail",
    "Checkout Order Confirmation Email": "always-fail",
    "Register With Very Long Name": "always-fail",
    "Filter By Rating": "always-fail",
    "Search Autocomplete Shows Suggestions": "flaky:0.5",
    "Payment Three D Secure Flow": "flaky:0.4",
    "Cart Persists After Reload": "flaky:0.3",
    "Login Remember Me Keeps Session": "flaky:0.25",
    "Track Shipment": "flaky:0.35",
    "Product Page Image Gallery": "flaky:0.2",
    "Checkout Select Pickup Point": "flaky:0.3",
    "Sort By Newest": "broken-since:7",
    "Download Invoice": "broken-since:7",
    "Pay With Ideal": "broken-since:7",
    "Filter Results Pagination": "broken-since:9",
    "Cart Apply Discount Code": "fixed-since:4",
    "Register Newsletter Opt In": "fixed-since:4",
    "Login Locks Account After Five Attempts": "fixed-since:6",
    "Search Laptop": "slow-outlier:0.3",
    "Checkout As Guest": "slow-outlier:0.25",
    "Product Page Shows Reviews": "slow-outlier:0.4",
    "Order History Shows Recent Orders": "slower-every-run:0.25",
    "Filter Combination Category And Price": "slower-every-run:0.2",
    "Cart Shows Correct Total": "faster-every-run:0.2",
    # --------------------------------------------------------------- WebshopAPI
    "Customer Merge Duplicates": "always-fail",
    "Inventory Report Export": "always-fail",
    "Token Rate Limit": "flaky:0.5",
    "Low Stock Webhook": "flaky:0.4",
    "Order Webhook Delivered": "flaky:0.3",
    "Order Export Csv": "broken-since:5",
    "Bulk Stock Import": "broken-since:5",
    "Cancel Shipped Order Returns 409": "fixed-since:3",
    "List Electronics": "slow-outlier:0.3",
    "Order Pagination": "slower-every-run:0.3",
    "Product Search Endpoint": "faster-every-run:0.25",
}

# Feature flags checked with `Require Feature`; a disabled flag skips the test.
# Value: callable(project, run_index) -> enabled?
FEATURE_FLAGS = {
    "wishlist": lambda project, run_index: run_index >= 4 and run_index != 8,
    "gift-cards": lambda project, run_index: True,
    "bulk-import": lambda project, run_index: run_index not in (2, 6),
}

# Runs where nothing fails, whatever the profiles say: "green" has no skips either
# (feature flags are forced on), "yellow" keeps the skips of that run.
CLEAN_RUNS = {
    ("WebshopAPI", 4): "green",
    ("WebshopAPI", 6): "yellow",
}

# Runs with an "outage": every otherwise passing test fails with this probability
# using OUTAGE_MESSAGES, and exceptions are raised far more often.
BAD_RUNS = {
    ("WebshopUI", 7): 0.35,
    ("WebshopAPI", 5): 0.3,
}

# Probability that a leaf keyword inside a TRY block raises a caught exception.
EXCEPTION_RATES = {
    "default": 0.06,
    ("WebshopUI", 3): 0.15,
    ("WebshopUI", 7): 0.6,
    ("WebshopAPI", 3): 0.25,
    ("WebshopAPI", 5): 0.5,
}

# Messages raised inside TRY blocks, per project. The resource keywords catch them by
# class-name glob (EXCEPT    ConnectionError*    ...), so every entry must start with a
# class the project's EXCEPT branches list, and failure messages below must never
# start with one of these class names.
EXCEPTION_MESSAGES = {
    "WebshopUI": [
        "ConnectionError: HTTPSConnectionPool(host='shop.local', port=443): Max retries exceeded",
        "ConnectionError: Connection reset by peer",
        "StaleElementError: element is not attached to the page document",
        "StaleElementError: element handle is detached from the DOM",
        "GatewayError: 504 Gateway Timeout from payment provider",
        "GatewayError: 502 Bad Gateway",
    ],
    "WebshopAPI": [
        "ConnectionError: HTTPSConnectionPool(host='api.shop.local', port=443): Max retries exceeded",
        "ConnectionError: Connection reset by peer",
        "ConnectionError: Read timed out (read timeout=30)",
        "RateLimitError: 429 Too Many Requests, retry after 2s",
        "GatewayError: 502 Bad Gateway",
    ],
}

# Failure messages per leaf keyword. Placeholders come from the keyword arguments
# plus `id` (random hex), `ms` and `actual` (random plausible values).
FAILURE_MESSAGES = {
    "default": [
        "Browser crashed: Target page, context or browser has been closed",
    ],
    "New Page": [
        "Navigation to '{url}' failed: net::ERR_CONNECTION_RESET",
        "Page '{url}' returned 502 Bad Gateway",
    ],
    "Go To": [
        "Navigation to '{url}' failed: net::ERR_CONNECTION_RESET",
        "Page '{url}' did not finish loading within {ms}ms",
    ],
    "Click": [
        "Element '{selector}' not visible after {ms}ms",
        "Element '{selector}' is covered by another element",
        "Element '{selector}' is not clickable",
    ],
    "Fill Text": [
        "Element '{selector}' is not editable",
        "Element '{selector}' not found",
    ],
    "Wait For Elements State": [
        "Timeout {ms}ms exceeded waiting for '{selector}' to be {state}",
    ],
    "Get Text": [
        "Text of '{selector}' should have been '{expected}' but was '{actual}'",
    ],
    "Get Element Count": [
        "Expected {expected} elements matching '{selector}' but found {actual_count}",
    ],
    "Get Url": [
        "URL should have been '{expected}' but was 'https://shop.local/error/500'",
    ],
    "Select Options By": [
        "Option '{value}' not found in '{selector}'",
    ],
    "Check Checkbox": [
        "Checkbox '{selector}' is disabled",
    ],
    "Upload File By Selector": [
        "File '{path}' could not be uploaded to '{selector}'",
    ],
    "GET": [
        "Request to {endpoint} timed out after {ms}ms",
        "Request to {endpoint} failed with 503 Service Unavailable",
    ],
    "POST": [
        "Request to {endpoint} timed out after {ms}ms",
        "Request to {endpoint} failed with 503 Service Unavailable",
    ],
    "PUT": [
        "Request to {endpoint} timed out after {ms}ms",
    ],
    "DELETE": [
        "Request to {endpoint} timed out after {ms}ms",
    ],
    "Status Should Be": [
        "Expected status {expected} but got 500 (request-id {id})",
        "Expected status {expected} but got 403",
        "Expected status {expected} but got 404",
    ],
    "Get Value From Json": [
        "JSON path '{path}' not found in response",
        "Value of '{path}' should have been '{expected}' but was 'null'",
    ],
    "Response Should Contain": [
        "Response does not contain key '{key}'",
    ],
}

OUTAGE_MESSAGES = {
    "WebshopUI": [
        "Application returned 502 Bad Gateway",
        "Page did not load within 30000ms (shop.local unreachable)",
    ],
    "WebshopAPI": [
        "Request failed with 503 Service Unavailable",
        "Expected status 200 but got 503",
    ],
}

# How attractive a keyword is as the place where a planned failure surfaces.
# < 3 means the failure is usually postponed to a later step.
STEP_WEIGHTS = {
    "Click": 3,
    "Wait For Elements State": 4,
    "Get Text": 4,
    "Get Element Count": 3,
    "Get Url": 3,
    "New Page": 2,
    "Go To": 2,
    "GET": 2,
    "POST": 2,
    "Status Should Be": 4,
    "Get Value From Json": 3,
    "Response Should Contain": 3,
}
