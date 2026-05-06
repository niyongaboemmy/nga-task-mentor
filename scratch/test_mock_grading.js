const { AdvancedQuizGrader, ChoiceQuestionGrader, InteractiveGrader } = require('../server/dist/utils/quizGrader');

// Mock question 12 from user JSON
const mockQuestion12 = {
    id: 12,
    points: 1,
    questionBank: {
        question_type: "single_choice",
        question_data: JSON.stringify({
            options: ["To store images", "To capture attention and communicate a message", "To create spreadsheets", "To edit videos"],
            correct_option_index: 1
        })
    }
};

// Mock answer 12
const mockAnswer12 = { selected_option_index: 1 };

async function testMock() {
    console.log('--- Testing Question 12 Mock ---');
    try {
        const result = await AdvancedQuizGrader.gradeWithConfig(mockQuestion12, mockAnswer12);
        console.log('Result:', JSON.stringify(result, null, 2));
    } catch (e) {
        console.error('Error:', e);
    }

    // Mock question 19 (Matching)
    const mockQuestion19 = {
        id: 19,
        points: 1,
        questionBank: {
            question_type: "matching",
            question_data: JSON.stringify({
                left_items:[{id:"p7vjkjq3w",text:"Headline"},{id:"2zfidbcgg",text:"Logo"},{id:"glixp71zp",text:"Call-to-Action"},{id:"pmf6r2fpu",text:"Background Shapes"}],
                right_items:[{id:"2oed7hxww",text:"Visual structure"},{id:"1hiklym3h",text:"Main message"},{id:"uva2iue8v",text:"Encourage user response"},{id:"0whopos3u",text:"Brand identity"}],
                correct_matches:{"p7vjkjq3w":"1hiklym3h","2zfidbcgg":"0whopos3u","glixp71zp":"uva2iue8v","pmf6r2fpu":"2oed7hxww"}
            })
        }
    };

    const mockAnswer19 = {
        matches: {"p7vjkjq3w":"1hiklym3h","2zfidbcgg":"0whopos3u","glixp71zp":"uva2iue8v","pmf6r2fpu":"2oed7hxww"}
    };

    console.log('\n--- Testing Question 19 Mock ---');
    try {
        const result = await AdvancedQuizGrader.gradeWithConfig(mockQuestion19, mockAnswer19);
        console.log('Result:', JSON.stringify(result, null, 2));
    } catch (e) {
        console.error('Error:', e);
    }
}

testMock();
