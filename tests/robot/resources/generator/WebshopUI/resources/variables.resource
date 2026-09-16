*** Variables ***
${BASE_URL}                 https://shop.local
${CUSTOMER_EMAIL}           jane.doe@example.com
${CUSTOMER_PASSWORD}        Secret123!
${ADMIN_EMAIL}              admin@example.com
${ADMIN_PASSWORD}           Adm1nPass!

# Header / navigation
${HEADER_LOGO}              id=header-logo
${COOKIE_ACCEPT}            id=cookie-accept
${NAV_LOGIN}                id=nav-login
${NAV_CART}                 id=nav-cart
${NAV_ACCOUNT}              id=nav-account
${NAV_WISHLIST}             id=nav-wishlist
${SEARCH_INPUT}             id=search-input
${SEARCH_SUBMIT}            id=search-submit
${SEARCH_SUGGESTIONS}       css=.search-suggestions li

# Login / registration
${LOGIN_EMAIL}              id=login-email
${LOGIN_PASSWORD}           id=login-password
${LOGIN_REMEMBER}           id=login-remember
${LOGIN_SUBMIT}             id=login-submit
${LOGIN_ERROR}              css=.login-form .alert-danger
${ACCOUNT_MENU}             id=account-menu
${WELCOME_BANNER}           css=.welcome-banner
${LOGOUT_LINK}              id=logout
${FORGOT_PASSWORD_LINK}     id=forgot-password
${RESET_EMAIL}              id=reset-email
${RESET_SUBMIT}             id=reset-submit
${RESET_CONFIRMATION}       css=.reset-confirmation
${REGISTER_LINK}            id=register-link
${REGISTER_NAME}            id=register-name
${REGISTER_EMAIL}           id=register-email
${REGISTER_PASSWORD}        id=register-password
${REGISTER_TERMS}           id=register-terms
${REGISTER_NEWSLETTER}      id=register-newsletter
${REGISTER_SUBMIT}          id=register-submit
${REGISTER_ERROR}           css=.register-form .alert-danger
${REGISTER_SUCCESS}         css=.register-success

# Catalog
${RESULT_CARDS}             css=.product-card
${RESULT_TITLE}             css=.results-title
${NO_RESULTS}               css=.no-results
${FILTER_CATEGORY}          id=filter-category
${FILTER_BRAND}             id=filter-brand
${FILTER_RATING}            id=filter-rating
${FILTER_PRICE_MIN}         id=filter-price-min
${FILTER_PRICE_MAX}         id=filter-price-max
${FILTER_APPLY}             id=filter-apply
${FILTER_CLEAR}             id=filter-clear
${SORT_SELECT}              id=sort-select
${PAGINATION_NEXT}          css=.pagination .next
${PRODUCT_TITLE}            css=.product-title
${PRODUCT_PRICE}            css=.product-price
${PRODUCT_STOCK}            css=.product-stock
${PRODUCT_GALLERY_NEXT}     css=.gallery .next
${PRODUCT_GALLERY_IMAGE}    css=.gallery img.active
${PRODUCT_REVIEWS_TAB}      id=tab-reviews
${PRODUCT_REVIEW_ITEMS}     css=.review-item
${PRODUCT_SPECS_TAB}        id=tab-specifications
${PRODUCT_SPECS_TABLE}      css=.specifications-table
${PRODUCT_RELATED}          css=.related-products .product-card
${PRODUCT_SIZE_SELECT}      id=product-size
${PRODUCT_ADD_TO_CART}      id=add-to-cart
${PRODUCT_ADD_TO_WISHLIST}  id=add-to-wishlist
${PRODUCT_SHARE_TWITTER}    css=.share-buttons .twitter
${PRODUCT_BREADCRUMBS}      css=.breadcrumbs
${PRODUCT_WRITE_REVIEW}     id=write-review

# Cart
${CART_ITEMS}               css=.cart-item
${CART_BADGE}               css=.cart-badge
${CART_TOTAL}               css=.cart-total
${CART_EMPTY}               css=.cart-empty
${CART_REMOVE}              css=.cart-item .remove
${CART_QUANTITY}            css=.cart-item .quantity
${CART_QUANTITY_ERROR}      css=.cart-item .quantity-error
${CART_DISCOUNT_INPUT}      id=discount-code
${CART_DISCOUNT_APPLY}      id=discount-apply
${CART_DISCOUNT_MESSAGE}    css=.discount-message
${CART_SHIPPING_NOTICE}     css=.shipping-notice
${CART_CHECKOUT}            id=proceed-to-checkout

# Wishlist
${WISHLIST_ITEMS}           css=.wishlist-item
${WISHLIST_REMOVE}          css=.wishlist-item .remove
${WISHLIST_MOVE_TO_CART}    css=.wishlist-item .move-to-cart
${WISHLIST_SHARE}           id=wishlist-share
${WISHLIST_SHARE_LINK}      id=wishlist-share-link

# Checkout
${CHECKOUT_GUEST}           id=checkout-as-guest
${CHECKOUT_EMAIL}           id=checkout-email
${ADDRESS_FIRST_NAME}       id=address-first-name
${ADDRESS_LAST_NAME}        id=address-last-name
${ADDRESS_STREET}           id=address-street
${ADDRESS_ZIP}              id=address-zip
${ADDRESS_CITY}             id=address-city
${ADDRESS_COUNTRY}          id=address-country
${ADDRESS_ERROR}            css=.address-form .invalid-feedback
${BILLING_DIFFERENT}        id=billing-different
${SHIPPING_STANDARD}        id=shipping-standard
${SHIPPING_EXPRESS}         id=shipping-express
${SHIPPING_PICKUP}          id=shipping-pickup
${PICKUP_POINT_SELECT}      id=pickup-point
${CHECKOUT_CONTINUE}        id=checkout-continue
${CHECKOUT_BACK}            id=checkout-back
${CHECKOUT_TERMS}           id=checkout-terms
${CHECKOUT_TERMS_ERROR}     css=.terms-error
${ORDER_SUMMARY_TOTAL}      css=.order-summary .total
${ORDER_SUMMARY_ITEMS}      css=.order-summary .item
${PAYMENT_CARD}             id=payment-card
${PAYMENT_PAYPAL}           id=payment-paypal
${PAYMENT_IDEAL}            id=payment-ideal
${CARD_NUMBER}              id=card-number
${CARD_EXPIRY}              id=card-expiry
${CARD_CVC}                 id=card-cvc
${IDEAL_BANK}               id=ideal-bank
${PAY_NOW}                  id=pay-now
${PAYMENT_ERROR}            css=.payment-error
${THREE_D_SECURE_FRAME}     css=iframe.three-d-secure
${THREE_D_SECURE_CONFIRM}   id=3ds-confirm
${ORDER_CONFIRMATION}       css=.order-confirmation
${ORDER_NUMBER}             css=.order-confirmation .order-number
${GIFT_CARD_INPUT}          id=gift-card-code
${GIFT_CARD_APPLY}          id=gift-card-apply
${GIFT_CARD_MESSAGE}        css=.gift-card-message

# Account
${PROFILE_NAME}             id=profile-name
${PROFILE_EMAIL}            id=profile-email
${PROFILE_SAVE}             id=profile-save
${PROFILE_SUCCESS}          css=.profile-success
${PROFILE_VERIFY_NOTICE}    css=.verify-email-notice
${PASSWORD_CURRENT}         id=password-current
${PASSWORD_NEW}             id=password-new
${PASSWORD_SAVE}            id=password-save
${PASSWORD_ERROR}           css=.password-form .alert-danger
${ADDRESS_ADD}              id=address-add
${ADDRESS_SAVE}             id=address-save
${ADDRESS_CARDS}            css=.address-card
${ADDRESS_DELETE}           css=.address-card .delete
${ADDRESS_SET_DEFAULT}      css=.address-card .set-default
${ADDRESS_DEFAULT_BADGE}    css=.address-card .badge-default
${ACCOUNT_DELETE}           id=account-delete
${ACCOUNT_DELETE_CONFIRM}   id=account-delete-confirm
${ORDER_ROWS}               css=.order-row
${ORDER_STATUS_FILTER}      id=order-status-filter
${ORDER_DETAILS_LINK}       css=.order-row .details
${ORDER_DETAILS_TITLE}      css=.order-details h1
${ORDER_REORDER}            id=order-reorder
${ORDER_INVOICE}            id=order-invoice
${ORDER_TRACKING}           id=order-tracking
${TRACKING_STATUS}          css=.tracking-status
