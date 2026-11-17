# CampusMarket test report

Tested by: Muhammad Iqram
Test accounts: one seller (also admin) and one buyer
Browsers: Chrome on laptop, Chrome on phone

Result column: write Pass or Fail. Add a short note for every Fail and how it was fixed.

## 1. Accounts and access

| ID | Test | Steps | Expected result | Result | Notes |
|---|---|---|---|---|---|
| T01 | Wrong password | Login with a wrong password | A clear error message is shown | Pass | | Msg is shown Invalid login credentials
| T02 | Register | Create a new account | Account is created and the user is sent to login | Pass | Yes The User is sent to login page |
| T03 | Protected pages | Open my-listings.html while logged out | The user is sent to the login page | Pass | When User press Sell Option While Log out then he is sent to Login Page |
| T04 | Buyer cannot sell | Press Sell as a buyer | A popup asks the user to enable selling in the profile | Pass | Yes The user is sent to the enable selling button |
| T05 | Enable selling | Accept the rules in Profile | Sell opens and My Listings appears in the navigation bar | Pass | When User Accept He is sent to Sell Option or Page |
| T06 | Admin page | Open admin.html as a normal user | Access is refused and the user is redirected | Pass | The Access Is Denied When We open admin.html as normal user |

## 2. Listings

| ID | Test | Steps | Expected result | Result | Notes |
|---|---|---|---|---|---|
| T07 | Form validation | Submit the Sell form empty, then without the confirmation tick | A clear message is shown each time | Pass | |
| T08 | Wrong file type | Choose a .docx file | The file is rejected with a message | | |
| T09 | PDF listing | Post a listing with a PDF | 3 preview pages are created and the listing appears on the home page | Pass | it Actually show the real preview of first 3 pages |
| T10 | Upload limit | Upload the same PDF 4 times | The 4th attempt is blocked and Post does nothing | | |
| T11 | Edit listing | Edit the title and price in My Listings | The new values appear on the home page | | |
| T12 | Edit another seller's listing | Open edit-listing.html?id= of another seller's listing | A message says only own listings can be edited | | |
| T13 | Status and delete | Change status to Sold, then delete a listing | Status is saved and the listing is removed | | |

## 3. Search and filters

| ID | Test | Steps | Expected result | Result | Notes |
|---|---|---|---|---|---|
| T14 | Course code search | Search for "CS" | Only matching listings are shown | | |
| T15 | No results | Search for a word that does not exist | A helpful message is shown | | |
| T16 | Filters and sorting | Use condition, price range and sorting | The list changes correctly and the Filters button shows the count | | |
| T17 | Chips | Press PDF notes, Textbooks, Exchange only | The matching listings are shown | | |

## 4. Requests, payments and downloads

| ID | Test | Steps | Expected result | Result | Notes |
|---|---|---|---|---|---|
| T18 | Request for a physical item | Buyer sends a request | Seller receives a popup and a notification | | |
| T19 | Payment with matching amount | Upload a screenshot that shows the price | The request is accepted and the download opens | | |
| T20 | Payment without matching amount | Upload a screenshot without the price | The request stays pending for the seller | | |
| T21 | Reused Transaction ID | Submit the same Transaction ID again | The message says the ID was already used | | |
| T22 | Seller review | Open Requests as the seller | Amount, Transaction ID, screenshot and check result are visible | | |
| T23 | Payment not received | Seller presses Payment not received | The request is declined, the buyer is notified and loses access | | |
| T24 | Download while logged out | Open a PDF listing without logging in | No download button is shown | | |

## 5. Safety and administration

| ID | Test | Steps | Expected result | Result | Notes |
|---|---|---|---|---|---|
| T25 | Report a listing | Report another seller's listing | The report is saved, a second report is refused | | |
| T26 | Hide a listing | Admin hides the reported listing | It disappears from the home page and the seller is notified | | |
| T27 | Restore a listing | Admin restores it | It appears again | | |
| T28 | Seller cannot unhide | Seller tries to set a hidden listing to Available | The change is refused | | |

## 6. Design and speed

| ID | Test | Steps | Expected result | Result | Notes |
|---|---|---|---|---|---|
| T29 | Phone layout | Check every page in phone mode | No page scrolls sideways and buttons are easy to press | | |
| T30 | Live site | Repeat the main flow on the live GitHub Pages site | Everything works the same as locally | | |
