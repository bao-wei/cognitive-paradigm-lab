Change Detection and Change Localisation task
------------------------------------------------

This is a Demo created by the Open Science Tools Team. 

The design of this study is based on (though not identical to) the following paper, which you may wish to cite if you use this task prototype. 

Zhao, C., Vogel, E. & Awh, E. Change localization: A highly reliable and sensitive measure of capacity in visual working memory. Atten Percept Psychophys 85, 1681–1694 (2023). https://doi.org/10.3758/s13414-022-02586-0


The task consists of two parts, a basic change detection task and a change localization task. 

In the change detection task participants see 6 squares placed at one of 8 random locations in a circle around a central point. They are then shown a single square in one of those 6 locations. That square can be the same as the original square in that location or different. Participants must identify if the color of the square in that location is the same or different from the square in that location in the first set. 

In the change localization task participants are shown 6 squares randomly at one of 8 locations selected from a circle around a central points. They then see the 6 squares again but one of the squares is different. Participants must identify which of the squares changed color. 

Conditions Files
------------------
* code/sampled_circle_points_with_colors.csv - The spreadsheet used for the change detection trials. x1/y1 and so on reflects the positions of each of the circles onscreen. color1 and so on reflects the colors of each circle onscreen. condition_label indicates if the test square should be the same color or a different color. answer = the correct key press for the participant. 

* code/localisation_trials_with_test_columns.xlsx - The spreadsheet used for the change localization trials.x1/y1 and so on reflects the positions of each of the circles onscreen. color1 and so on reflects the colors of each circle onscreen. testcolor1 and so on reflects the colors of the test squares. changed_color_index indicates the index of the square that changed color.

Data Output
-------------

* key_resp.corr - if the participant was correct in each trial of the change detection task. 1 = correct 0 = incorrect. 
* localisation_resp.corr - if the participant was correct for each trial of the localization part of the task 1 = correct, 0 = incorrect. 

Code
-----
This folder contains some helper scripts used to generate conditions spreadsheets. 

generate_locations.py - outputs sampled_circle_points_with_colors.csv which has a column for the x and y coordinate of each of the 6 squares along with the colour of each square. This sheet was manually updated to add teh same/different column. The code component in the show_test routine of the .psyexp file then uses the same/different column to randomly pick a square to test and keep its colour the same (if condition_label = same) or change (if condition_label = different)

addtestcolor.py was used to adapt the spreadsheet created by the above script to add additional coloumns to present 6 test squares where one of the squares has a different colour. This spreadsheet is used by the localisation trials. 

You can choose to use the above scripts to help create your trials or you can manually update the spreadsheets to contain the locations and colours of each square as you wish. 