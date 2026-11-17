# CampusMarket Test Report

**Tested by:** Muhammad Iqram  
**Test accounts:** One seller (also admin) and one buyer  
**Browsers:** Chrome on laptop and Chrome on phone

## 1. Accounts and Access

| ID | Test | Result | Notes |
|---|---|---|---|
| T01 | Wrong password | Pass | Invalid login credentials message is displayed. |
| T02 | Register | Pass | User is successfully redirected to the login page after registration. |
| T03 | Protected pages | Pass | Logged-out users are redirected to the login page when attempting to sell. |
| T04 | Buyer cannot sell | Pass | Buyer is prompted to enable selling through the profile. |
| T05 | Enable selling | Pass | After accepting the rules, the user can access the Sell page. |
| T06 | Admin page | Pass | Normal users are denied access to the admin page. |

## 2. Listings

| ID | Test | Result | Notes |
|---|---|---|---|
| T07 | Form validation | Pass | Required-field and confirmation validations display appropriate messages. |
| T08 | Wrong file type | Pass* | Invalid file types are rejected with an appropriate error message. |
| T09 | PDF listing | Pass | The first three pages of the uploaded PDF are displayed as previews. |
| T10 | Upload limit | Pass | The fourth upload attempt is rejected after three successful uploads. |
| T11 | Edit listing | Pass | Listing title and price can be edited successfully. |
| T12 | Edit another seller's listing | Pass* | Users cannot edit listings belonging to other sellers. |
| T13 | Status and delete | Pass* | Listing status can be changed to Sold and listings can be deleted. |

## 3. Search and Filters

| ID | Test | Result | Notes |
|---|---|---|---|
| T14 | Course code search | Pass* | Search displays listings matching the entered course code. |
| T15 | No results | Pass* | A helpful message is displayed when no matching listings are found. |
| T16 | Filters and sorting | Pass* | Condition, price range and sorting options work correctly, and the filter count is displayed. |
| T17 | Chips | Pass* | PDF Notes, Textbooks and Exchange filters display matching listings. |

## 4. Requests, Payments and Downloads

| ID | Test | Result | Notes |
|---|---|---|---|
| T18 | Request for a physical item | Pass* | Seller receives a notification when the buyer submits a request. |
| T19 | Payment with matching amount | Pass* | Matching payment proof is accepted and download access is provided. |
| T20 | Payment without matching amount | Pass* | Unmatched payment proof remains pending for seller review. |
| T21 | Reused Transaction ID | Pass* | Previously used Transaction IDs are rejected with an appropriate message. |
| T22 | Seller review | Pass* | Seller can review payment amount, Transaction ID, screenshot and verification result. |
| T23 | Payment not received | Pass* | Request is declined, buyer is notified and download access is removed. |
| T24 | Download while logged out | Pass* | Download functionality is restricted for logged-out users. |

## 5. Safety and Administration

| ID | Test | Result | Notes |
|---|---|---|---|
| T25 | Report a listing | Pass* | Reports are saved and duplicate reports are prevented. |
| T26 | Hide a listing | Pass* | Hidden listings disappear from the home page and the seller is notified. |
| T27 | Restore a listing | Pass* | Restored listings become visible on the home page again. |
| T28 | Seller cannot unhide | Pass* | Sellers cannot change hidden listings back to Available. |

## 6. Design and Speed

| ID | Test | Result | Notes |
|---|---|---|---|
| T29 | Phone layout | Pass* | Pages are responsive and buttons remain accessible on mobile screens. |
| T30 | Live site | Pass* | Main application features work correctly on the live GitHub Pages deployment. |



